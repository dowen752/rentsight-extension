import { isExtensionRequest, type ExtensionResponse } from '../shared/messages';

const CONTENT_SCRIPT_FILE = 'content.js';

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
      return (await chrome.tabs.sendMessage(tab.id!, {
        type: 'GET_PAGE_INFO',
      })) as ExtensionResponse;
    } catch {
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
      return (await chrome.tabs.sendMessage(tab.id!, {
        type: 'GET_PAGE_INFO',
      })) as ExtensionResponse;
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
