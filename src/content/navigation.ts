export interface NavigationObserver {
  disconnect(): void;
}

export function observeListingNavigation(
  window: Window,
  document: Document,
  callback: () => void,
  debounceMs = 500,
  pollMs = 750,
): NavigationObserver {
  let previousUrl = window.location.href;
  let timer: number | undefined;
  const detectNavigation = () => {
    const currentUrl = window.location.href;
    if (currentUrl === previousUrl) return;
    previousUrl = currentUrl;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      callback();
    }, debounceMs);
  };
  void document;
  window.addEventListener('popstate', detectNavigation);
  window.addEventListener('hashchange', detectNavigation);
  const poll = window.setInterval(detectNavigation, pollMs);
  return {
    disconnect() {
      window.removeEventListener('popstate', detectNavigation);
      window.removeEventListener('hashchange', detectNavigation);
      window.clearTimeout(timer);
      window.clearInterval(poll);
    },
  };
}
