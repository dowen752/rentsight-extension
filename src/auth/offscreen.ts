import { FIREBASE_AUTH_HOST_URL } from './config';

const iframe = document.createElement('iframe');
iframe.src = FIREBASE_AUTH_HOST_URL;
iframe.setAttribute('aria-hidden', 'true');
document.documentElement.appendChild(iframe);

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (
      typeof message !== 'object' ||
      message === null ||
      !('target' in message) ||
      message.target !== 'firebase-auth-offscreen'
    )
      return false;

    const hostOrigin = new URL(FIREBASE_AUTH_HOST_URL).origin;
    const handleIframeMessage = (event: MessageEvent) => {
      if (event.origin !== hostOrigin || event.source !== iframe.contentWindow)
        return;
      if (typeof event.data !== 'object' || event.data === null) return;
      globalThis.removeEventListener('message', handleIframeMessage);
      sendResponse(event.data);
    };
    globalThis.addEventListener('message', handleIframeMessage);
    iframe.contentWindow?.postMessage(
      { type: 'FIREBASE_GOOGLE_SIGN_IN' },
      hostOrigin,
    );
    return true;
  },
);
