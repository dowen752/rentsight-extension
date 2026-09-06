import { isExtensionRequest, type ExtensionResponse } from '../shared/messages';
import {
  FIREBASE_AUTH_HOST_URL,
  federatedAuthIsConfigured,
} from '../auth/config';

const CONTENT_SCRIPT_FILE = 'content.js';
const PAGE_INSPECTION_TIMEOUT_MS = 5_000;
const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';
let creatingOffscreenDocument: Promise<void> | undefined;

async function hasOffscreenDocument(): Promise<boolean> {
  const documentUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [documentUrl],
  });
  return contexts.length > 0;
}

async function setupOffscreenDocument(): Promise<void> {
  if (await hasOffscreenDocument()) return;
  if (!creatingOffscreenDocument) {
    creatingOffscreenDocument = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_DOCUMENT_PATH,
        reasons: [chrome.offscreen.Reason.DOM_SCRAPING],
        justification: 'Complete Firebase federated authentication.',
      })
      .finally(() => {
        creatingOffscreenDocument = undefined;
      });
  }
  await creatingOffscreenDocument;
}

async function requestGoogleCredential(): Promise<unknown> {
  if (!federatedAuthIsConfigured() || !FIREBASE_AUTH_HOST_URL)
    return {
      error: 'Google sign-in is not configured.',
    };
  await setupOffscreenDocument();
  try {
    return await chrome.runtime.sendMessage({
      target: 'firebase-auth-offscreen',
    });
  } finally {
    if (await hasOffscreenDocument()) await chrome.offscreen.closeDocument();
  }
}

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
  if (!tab?.id)
    throw new Error(
      'Return to an accessible rental listing tab and click Refresh listing to try again.',
    );
  if (tab.url && !/^https?:/.test(tab.url)) {
    throw new Error(
      'Return to an HTTP or HTTPS rental listing tab and click Refresh listing to try again.',
    );
  }
  return tab;
}

async function requestPageInfo(
  type: 'GET_PAGE_INFO' | 'GET_AI_CAPTURE',
): Promise<ExtensionResponse> {
  try {
    const tab = await getActiveTab();

    try {
      return (await withInspectionTimeout(
        chrome.tabs.sendMessage(tab.id!, { type }),
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
          'Return to a rental listing tab and click Refresh listing to try again.',
          { cause: error },
        );
      }
      return (await withInspectionTimeout(
        chrome.tabs.sendMessage(tab.id!, { type }),
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
    if (
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      message.type === 'FIREBASE_GOOGLE_SIGN_IN'
    ) {
      void requestGoogleCredential().then(sendResponse, (error: unknown) =>
        sendResponse({
          error:
            error instanceof Error ? error.message : 'Google sign-in failed.',
        }),
      );
      return true;
    }
    if (!isExtensionRequest(message)) return false;
    void requestPageInfo(message.type).then(sendResponse);
    return true;
  },
);
