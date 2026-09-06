import { captureListing, readSelectedLeaseTermMonths } from '../ai/capture';
import { scoreListingPage } from '../ai/eligibility';
import { developmentDiagnostic } from '../ai/cache';
import { appearsToBeRentalListing } from '../shared/listing';
import { extractListing } from '../extractors';
import type { ListingExtraction } from '../extractors';
import { emptyExtraction } from '../extractors/types';
import { observeListingNavigation } from './navigation';
import {
  appearsToBeHomesRental,
  appearsToBeSupportedSiteRental,
  requiresHomesUnitSelection,
  requiresRedfinUnitSelection,
  requiresZillowUnitSelection,
  selectedHomesUnitId,
  selectedApartmentsUnitId,
  selectedRedfinUnitId,
  selectedZillowUnitId,
} from './pageState';
import type {
  ExtensionRequest,
  ExtensionResponse,
  PageInfo,
} from '../shared/messages';

const isExtensionRequest = (value: unknown): value is ExtensionRequest =>
  typeof value === 'object' &&
  value !== null &&
  'type' in value &&
  (value.type === 'GET_PAGE_INFO' || value.type === 'GET_AI_CAPTURE');

const selectedUnitIdForPage = (
  document: Document,
  url: URL,
): string | undefined =>
  selectedApartmentsUnitId(document, url) ??
  selectedZillowUnitId(document, url) ??
  selectedHomesUnitId(document, url) ??
  selectedRedfinUnitId(document, url);

function getPageInfo(): PageInfo {
  const browserUrl = window.location.href;
  const parsedUrl = new URL(browserUrl);
  const selectedUnitId = selectedUnitIdForPage(document, parsedUrl);
  const url = selectedUnitId
    ? `${browserUrl.split('#')[0]}#rentsight-unit=${encodeURIComponent(selectedUnitId)}`
    : browserUrl;
  const title = document.title;
  const requiresUnitSelection =
    requiresZillowUnitSelection(document, parsedUrl) ||
    requiresHomesUnitSelection(document, parsedUrl) ||
    requiresRedfinUnitSelection(document, parsedUrl);
  let extraction: ListingExtraction;
  if (requiresUnitSelection) {
    return {
      url,
      title,
      appearsToBeRentalListing: true,
      requiresUnitSelection: true,
      selectedUnitId,
    };
  }
  try {
    const extractionUrl = new URL(parsedUrl);
    if (selectedUnitId)
      extractionUrl.hash = `rentsight-unit=${encodeURIComponent(selectedUnitId)}`;
    extraction = extractListing(document, extractionUrl);
  } catch (error: unknown) {
    console.warn(
      '[RentSight] Listing extraction failed; manual entry remains available',
      error,
    );
    extraction = emptyExtraction('Manual fallback', '1.0.0');
    extraction.warnings.push(
      'Automatic extraction failed. You can still enter the listing manually.',
    );
  }
  const eligibility = scoreListingPage(document, parsedUrl, extraction);
  developmentDiagnostic('eligibility', {
    classification: eligibility.classification,
    score: eligibility.score,
    positiveSignals: eligibility.positiveSignals,
    negativeSignals: eligibility.negativeSignals,
  });
  const listingSignal =
    appearsToBeRentalListing(url, title) ||
    appearsToBeHomesRental(document, parsedUrl) ||
    appearsToBeSupportedSiteRental(document, parsedUrl, extraction);
  return {
    url,
    title,
    appearsToBeRentalListing:
      listingSignal && eligibility.classification !== 'low',
    requiresUnitSelection: false,
    selectedUnitId,
    extraction,
    eligibility,
  };
}

const contentWindow = window as Window & { __rentSightInitialized?: boolean };
if (!contentWindow.__rentSightInitialized) {
  contentWindow.__rentSightInitialized = true;
  chrome.runtime.onMessage.addListener(
    (message: unknown, _sender, sendResponse) => {
      if (!isExtensionRequest(message)) return false;

      const payload = getPageInfo();
      if (message.type === 'GET_AI_CAPTURE' && payload.extraction) {
        try {
          payload.aiCapture = captureListing(document, payload.extraction);
        } catch {
          console.warn(
            '[RentSight] AI capture failed; local extraction remains available',
          );
        }
      }
      const response: ExtensionResponse = {
        type: 'PAGE_INFO_RESPONSE',
        payload,
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

  // Detail drawers and client-rendered listing facts may appear without a URL
  // change. Re-publish only when a compact, listing-relevant signature changes.
  let settleTimer: number | undefined;
  let previousDetailSignature = '';
  const detailObserver = new MutationObserver(() => {
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => {
      const currentUrl = new URL(window.location.href);
      const root =
        document.querySelector('main, [role="main"]') ?? document.body;
      const text = root?.textContent ?? '';
      const signature = JSON.stringify([
        window.location.href,
        selectedUnitIdForPage(document, currentUrl),
        document.querySelector('h1')?.textContent?.trim(),
        (text.match(/\$\s?[\d,]+/g) ?? []).slice(0, 12),
      ]);
      if (signature === previousDetailSignature) return;
      previousDetailSignature = signature;
      const payload = getPageInfo();
      void chrome.runtime
        .sendMessage({ type: 'EXTRACTION_UPDATED', payload })
        .catch(() => undefined);
    }, 1_200);
  });
  detailObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  let previousLease = readSelectedLeaseTermMonths(document);
  document.addEventListener('change', () => {
    const lease = readSelectedLeaseTermMonths(document);
    if (lease === previousLease) return;
    previousLease = lease;
    void chrome.runtime
      .sendMessage({ type: 'EXTRACTION_UPDATED', payload: getPageInfo() })
      .catch(() => undefined);
  });

  const apartmentUrl = new URL(window.location.href);
  if (
    (/(^|\.)zillow\.com$/i.test(apartmentUrl.hostname) &&
      /\/apartments\//i.test(apartmentUrl.pathname)) ||
    /(^|\.)apartments\.com$/i.test(apartmentUrl.hostname) ||
    (/(^|\.)homes\.com$/i.test(apartmentUrl.hostname) &&
      /\/property\//i.test(apartmentUrl.pathname)) ||
    (/(^|\.)redfin\.com$/i.test(apartmentUrl.hostname) &&
      requiresRedfinUnitSelection(document, apartmentUrl))
  ) {
    let unitTimer: number | undefined;
    let previousUnitId: string | undefined;
    const detectUnit = () => {
      const currentUrl = new URL(window.location.href);
      const unitId = selectedUnitIdForPage(document, currentUrl);
      if (!unitId) {
        previousUnitId = undefined;
        return;
      }
      if (unitId === previousUnitId) return;
      previousUnitId = unitId;
      window.clearTimeout(unitTimer);
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
