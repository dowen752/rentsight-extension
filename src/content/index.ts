import { appearsToBeRentalListing } from '../shared/listing';
import { extractListing } from '../extractors';
import { emptyExtraction } from '../extractors/types';
import { observeListingNavigation } from './navigation';
import {
  isExtensionRequest,
  type ExtensionResponse,
  type PageInfo,
} from '../shared/messages';

function getPageInfo(): PageInfo {
  const url = window.location.href;
  const title = document.title;

  const page: PageInfo = {
    url,
    title,
    appearsToBeRentalListing: appearsToBeRentalListing(url, title),
  };
  try {
    page.extraction = extractListing(document, new URL(url));
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
