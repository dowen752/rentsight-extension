export interface NavigationObserver {
  disconnect(): void;
}

export function observeListingNavigation(
  window: Window,
  _document: Document,
  callback: () => void,
  debounceMs = 500,
  pollMs = 2_000,
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
  window.addEventListener('popstate', detectNavigation);
  window.addEventListener('hashchange', detectNavigation);
  const navigation = (
    window as Window & {
      navigation?: EventTarget;
    }
  ).navigation;
  navigation?.addEventListener('navigatesuccess', detectNavigation);
  // Chromium's Navigation API observes pushState/replaceState performed by the
  // page's main world. Retain a slower fallback only for test/older runtimes.
  const poll = navigation
    ? undefined
    : window.setInterval(detectNavigation, pollMs);
  return {
    disconnect() {
      window.removeEventListener('popstate', detectNavigation);
      window.removeEventListener('hashchange', detectNavigation);
      window.clearTimeout(timer);
      navigation?.removeEventListener('navigatesuccess', detectNavigation);
      if (poll !== undefined) window.clearInterval(poll);
    },
  };
}
