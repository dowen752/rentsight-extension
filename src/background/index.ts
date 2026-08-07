import { isExtensionRequest, type ExtensionResponse } from '../shared/messages';

const CONTENT_SCRIPT_FILE = 'content.js';
const PAGE_INSPECTION_TIMEOUT_MS = 5_000;

const isMissingContentScript = (error: unknown): boolean =>
  error instanceof Error &&
  /receiving end does not exist|could not establish connection/i.test(
    error.message,
  );

async function withInspectionTimeout<T>(request: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () =>
            reject(new Error('Page inspection timed out. Please try again.')),
          PAGE_INSPECTION_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  console.info('[RentSight] Extension initialized');
});

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: false })
  .catch((error: unknown) =>
    console.error('[RentSight] Side panel setup failed', error),
  );

chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) {
    console.error('[RentSight] Extension action did not include a tab ID');
    return;
  }

  void chrome.sidePanel
    .open({ tabId: tab.id })
    .catch((error: unknown) =>
      console.error('[RentSight] Could not open the side panel', error),
    );
});

async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active browser tab is available.');
  if (tab.url && !/^https?:/.test(tab.url)) {
    throw new Error('RentSight can only inspect HTTP or HTTPS pages.');
  }
  return tab;
}

async function requestPageInfo(): Promise<ExtensionResponse> {
  try {
    const tab = await getActiveTab();

    try {
      return (await withInspectionTimeout(
        chrome.tabs.sendMessage(tab.id!, { type: 'GET_PAGE_INFO' }),
      )) as ExtensionResponse;
    } catch (error: unknown) {
      // A timeout or extractor failure means the existing content script is
      // already present. Reinjection cannot interrupt it and would only issue
      // another expensive inspection request.
      if (!isMissingContentScript(error)) throw error;
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id! },
          files: [CONTENT_SCRIPT_FILE],
        });
      } catch (error: unknown) {
        console.error('[RentSight] Content script injection failed', error);
        throw new Error(
          'RentSight needs access to this tab. Close this panel, then click the RentSight toolbar icon while the listing is active.',
          { cause: error },
        );
      }
      return (await withInspectionTimeout(
        chrome.tabs.sendMessage(tab.id!, { type: 'GET_PAGE_INFO' }),
      )) as ExtensionResponse;
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unable to inspect this page.';
    console.error('[RentSight] Page inspection failed', error);
    return { type: 'EXTENSION_ERROR', error: message };
  }
}

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (!isExtensionRequest(message)) return false;
    void requestPageInfo().then(sendResponse);
    return true;
  },
);
