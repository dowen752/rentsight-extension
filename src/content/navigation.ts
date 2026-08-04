export interface NavigationObserver {
  disconnect(): void;
}

export function observeListingNavigation(
  window: Window,
  document: Document,
  callback: () => void,
  debounceMs = 500,
): NavigationObserver {
  let previousUrl = window.location.href;
  let timer: number | undefined;
  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (window.location.href !== previousUrl) {
        previousUrl = window.location.href;
        callback();
      }
    }, debounceMs);
  };
  const Observer = (
    window as Window & { MutationObserver: typeof MutationObserver }
  ).MutationObserver;
  const observer = new Observer(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  window.addEventListener('popstate', schedule);
  window.addEventListener('hashchange', schedule);
  const originalPush = window.history.pushState.bind(window.history);
  const originalReplace = window.history.replaceState.bind(window.history);
  window.history.pushState = (...args) => {
    originalPush(...args);
    schedule();
  };
  window.history.replaceState = (...args) => {
    originalReplace(...args);
    schedule();
  };
  return {
    disconnect() {
      observer.disconnect();
      window.removeEventListener('popstate', schedule);
      window.removeEventListener('hashchange', schedule);
      window.clearTimeout(timer);
      window.history.pushState = originalPush;
      window.history.replaceState = originalReplace;
    },
  };
}
