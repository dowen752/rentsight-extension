import { appearsToBeRentalListing } from '../shared/listing';
import { extractListing } from '../extractors';
import { emptyExtraction } from '../extractors/types';
import { observeListingNavigation } from './navigation';
import { requiresZillowUnitSelection, selectedZillowUnitId } from './pageState';
import type {
  ExtensionRequest,
  ExtensionResponse,
  PageInfo,
} from '../shared/messages';

const isExtensionRequest = (value: unknown): value is ExtensionRequest =>
  typeof value === 'object' &&
  value !== null &&
  'type' in value &&
  value.type === 'GET_PAGE_INFO';

function getPageInfo(): PageInfo {
  const browserUrl = window.location.href;
  const parsedUrl = new URL(browserUrl);
  const selectedUnitId = selectedZillowUnitId(document, parsedUrl);
  const url = selectedUnitId
    ? `${browserUrl.split('#')[0]}#rentsight-unit=${encodeURIComponent(selectedUnitId)}`
    : browserUrl;
  const title = document.title;

  const page: PageInfo = {
    url,
    title,
    appearsToBeRentalListing: appearsToBeRentalListing(url, title),
    requiresUnitSelection: requiresZillowUnitSelection(document, parsedUrl),
    selectedUnitId,
  };
  if (page.requiresUnitSelection) return page;
  try {
    const extractionUrl = new URL(parsedUrl);
    if (selectedUnitId)
      extractionUrl.hash = `rentsight-unit=${encodeURIComponent(selectedUnitId)}`;
    page.extraction = extractListing(document, extractionUrl);
  } catch (error: unknown) {
    console.warn(
      '[RentSight] Listing extraction failed; manual entry remains available',
      error,
    );
    page.extraction = emptyExtraction('Manual fallback', '1.0.0');
    page.extraction.warnings.push(
      'Automatic extraction failed. You can still enter the listing manually.',
    );
  }
  return page;
}

const contentWindow = window as Window & { __rentSightInitialized?: boolean };
if (!contentWindow.__rentSightInitialized) {
  contentWindow.__rentSightInitialized = true;
  chrome.runtime.onMessage.addListener(
    (message: unknown, _sender, sendResponse) => {
      if (!isExtensionRequest(message)) return false;

      const response: ExtensionResponse = {
        type: 'PAGE_INFO_RESPONSE',
        payload: getPageInfo(),
      };
      sendResponse(response);
      return false;
    },
  );

  console.debug('[RentSight] Content script ready', window.location.href);

  observeListingNavigation(window, document, () => {
    const payload = getPageInfo();
    void chrome.runtime
      .sendMessage({ type: 'EXTRACTION_UPDATED', payload })
      .catch((error: unknown) =>
        console.debug(
          '[RentSight] Could not publish navigation extraction',
          error,
        ),
      );
  });

  const apartmentUrl = new URL(window.location.href);
  if (
    /(^|\.)zillow\.com$/i.test(apartmentUrl.hostname) &&
    /\/apartments\//i.test(apartmentUrl.pathname)
  ) {
    let unitTimer: number | undefined;
    const detectUnit = () => {
      const unitId = selectedZillowUnitId(
        document,
        new URL(window.location.href),
      );
      if (!unitId) return;
      window.clearTimeout(unitTimer);
      observer.disconnect();
      const browserUrl = window.location.href.split('#')[0];
      const payload: PageInfo = {
        url: `${browserUrl}#rentsight-unit=${encodeURIComponent(unitId)}`,
        title: document.title,
        appearsToBeRentalListing: true,
        selectedUnitId: unitId,
        requiresUnitSelection: false,
      };
      void chrome.runtime
        .sendMessage({ type: 'EXTRACTION_UPDATED', payload })
        .catch(() => undefined);
    };
    const observer = new MutationObserver(() => {
      if (unitTimer !== undefined) return;
      unitTimer = window.setTimeout(() => {
        unitTimer = undefined;
        detectUnit();
      }, 500);
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    detectUnit();
  }
}
