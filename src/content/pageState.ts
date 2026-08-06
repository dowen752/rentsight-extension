export function selectedZillowUnitId(
  document: Document,
  url: URL,
): string | undefined {
  if (
    !/(^|\.)zillow\.com$/i.test(url.hostname) ||
    !/\/apartments\//i.test(url.pathname)
  )
    return undefined;
  const selectedUnitRoute = url.hash.match(/^#(uap-[\w/-]+)$/i)?.[1];
  if (selectedUnitRoute) return selectedUnitRoute;
  for (const heading of document.querySelectorAll('h1, h2')) {
    const match = heading.textContent
      ?.replace(/\s+/g, ' ')
      .trim()
      .match(/^Unit\s+([\w-]+)$/i);
    if (match) return match[1];
  }
  return undefined;
}

export function requiresZillowUnitSelection(
  document: Document,
  url: URL,
): boolean {
  // Zillow's /apartments/ route represents a community whose units can have
  // different rents, dimensions, fees, and availability. Decide from the URL
  // before reading the potentially enormous community DOM; scanning that DOM
  // can block the page's main thread for several seconds.
  return (
    /(^|\.)zillow\.com$/i.test(url.hostname) &&
    /\/apartments\//i.test(url.pathname) &&
    !selectedZillowUnitId(document, url)
  );
}
