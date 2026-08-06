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
  const Observer = (
    window as Window & { MutationObserver: typeof MutationObserver }
  ).MutationObserver;
  const observer = new Observer(detectNavigation);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  window.addEventListener('popstate', detectNavigation);
  window.addEventListener('hashchange', detectNavigation);
  const poll = window.setInterval(detectNavigation, pollMs);
  const originalPush = window.history.pushState.bind(window.history);
  const originalReplace = window.history.replaceState.bind(window.history);
  window.history.pushState = (...args) => {
    originalPush(...args);
    detectNavigation();
  };
  window.history.replaceState = (...args) => {
    originalReplace(...args);
    detectNavigation();
  };
  return {
    disconnect() {
      observer.disconnect();
      window.removeEventListener('popstate', detectNavigation);
      window.removeEventListener('hashchange', detectNavigation);
      window.clearTimeout(timer);
      window.clearInterval(poll);
      window.history.pushState = originalPush;
      window.history.replaceState = originalReplace;
    },
  };
}
