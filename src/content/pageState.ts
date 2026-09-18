import type { ListingExtraction } from '../extractors';

const normalizedPageText = (document: Document): string =>
  (document.body?.textContent ?? '').replace(/\s+/g, ' ');

export function appearsToBeSupportedSiteRental(
  document: Document,
  url: URL,
  extraction?: ListingExtraction,
): boolean {
  const text = normalizedPageText(document);

  if (/(^|\.)apartmentlist\.com$/i.test(url.hostname)) {
    // Apartment List community routes are rental inventory even when the page
    // title contains only the property's marketing name.
    return url.pathname.split('/').filter(Boolean).length >= 3;
  }

  if (/(^|\.)zillow\.com$/i.test(url.hostname)) {
    // Zillow sale pages can contain both a Rent Zestimate and monthly mortgage
    // estimates. Require an explicit listing-status or application signal.
    return (
      /\b(?:house|home|apartment|condo|townhouse)?\s*for rent\b/i.test(text) ||
      /\brequest to apply\b/i.test(text)
    );
  }

  if (/(^|\.)redfin\.com$/i.test(url.hostname)) {
    // The Redfin extractor only produces rent evidence from a price explicitly
    // labeled "/mo", so it is safe to use that result as a secondary signal.
    return (
      /\bfor rent\b/i.test(text) ||
      /\b(?:opportunity|property|home) to lease\b/i.test(text) ||
      /\brental requests?\b/i.test(text) ||
      extraction?.rent !== undefined
    );
  }

  if (/(^|\.)rent\.com$/i.test(url.hostname)) {
    return /\/r\//i.test(url.pathname);
  }

  return false;
}

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

export function selectedRealtorUnit(
  document: Document,
  url: URL,
): { id: string | null; label: string } | undefined {
  if (!/(^|\.)realtor\.com$/i.test(url.hostname)) return undefined;
  const dialog = Array.from(
    document.querySelectorAll<HTMLElement>(
      '[role="dialog"][aria-modal="true"]',
    ),
  ).find((item) => item.querySelector('[data-testid="modal-body"] table'));
  if (!dialog) return undefined;
  const selected = dialog.querySelector<HTMLSelectElement>(
    'select[name="listingUnit"]',
  )?.selectedOptions[0];
  const selectedId = selected?.value.trim();
  const selectedLabel = selected?.textContent?.replace(/\s+/g, ' ').trim();
  if (selectedId && selectedLabel)
    return {
      id: selectedId.replace(/^unit_/, '') || null,
      label: selectedLabel,
    };
  const floorPlan = dialog
    .querySelector('h1,h2,h3,h4')
    ?.textContent?.replace(/\s+/g, ' ')
    .trim();
  return floorPlan ? { id: null, label: floorPlan } : undefined;
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

export function selectedApartmentsUnitDialog(
  document: Document,
): Element | undefined {
  const dialog = document.querySelector(
    '#rentalDetailContainer, #rentalDetailModalContentContainer, .unit-detail-wrapper',
  );
  if (!dialog) return undefined;
  const text = [...dialog.querySelectorAll('.specs-header, .unit-specs li')]
    .map((node) => node.textContent?.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ');
  return /\bBase Price:\s*\$[\d,]+/i.test(text) &&
    /(?:^|\s)(?:Studio|\d+(?:\.\d+)?\s*Beds?)\b/i.test(text)
    ? dialog
    : undefined;
}

export function selectedApartmentsUnitId(
  document: Document,
  url: URL,
): string | undefined {
  if (!/(^|\.)apartments\.com$/i.test(url.hostname)) return undefined;
  const dialog = selectedApartmentsUnitDialog(document);
  // Apartments.com updates the hash before it finishes mounting the modal.
  // Wait for readable unit facts so the resulting navigation cannot capture
  // the community-level range instead of the selected unit.
  if (!dialog) return undefined;
  const syntheticRoute = url.hash.match(/^#rentsight-unit=(.+)$/i)?.[1];
  if (syntheticRoute) return decodeURIComponent(syntheticRoute);
  const unitRoute = url.hash.match(/^#([^#]+-unit)$/i)?.[1];
  if (unitRoute) return unitRoute;
  return dialog
    .querySelector('.specs-header:not(.pricing)')
    ?.textContent?.replace(/\s+/g, ' ')
    .trim();
}

export function selectedRedfinUnitDialog(
  document: Document,
): Element | undefined {
  for (const dialog of document.querySelectorAll(
    '#bp-dialog-container[role="dialog"], [role="dialog"][data-rf-test-name="dialogGutsNode"], [role="dialog"]',
  )) {
    const header = dialog.querySelector(
      '.name-and-rent, [class*="name-and-rent"]',
    )?.textContent;
    const details = dialog.querySelector(
      '.details, [class*="dialog-title"] .details',
    )?.textContent;
    if (
      header &&
      /\$[\d,]+(?:\.\d{2})?\s*\/\s*mo\b/i.test(header) &&
      details &&
      /\b(?:bath|sqft|sq\s*ft)\b/i.test(details)
    )
      return dialog;
  }
  return undefined;
}

export function selectedRedfinUnitId(
  document: Document,
  url: URL,
): string | undefined {
  if (!/(^|\.)redfin\.com$/i.test(url.hostname)) return undefined;
  const route = url.hash.match(/^#rentsight-unit=(.+)$/i)?.[1];
  if (route) return decodeURIComponent(route);
  const header = selectedRedfinUnitDialog(document)?.querySelector(
    '.name-and-rent, [class*="name-and-rent"]',
  )?.textContent;
  return header?.replace(/\s+/g, ' ').trim();
}

export function requiresRedfinUnitSelection(
  document: Document,
  url: URL,
): boolean {
  if (!/(^|\.)redfin\.com$/i.test(url.hostname)) return false;
  const hasAvailableUnits = [...document.querySelectorAll('h1, h2, h3')].some(
    (heading) =>
      /^available units$/i.test(
        heading.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      ),
  );
  return hasAvailableUnits && !selectedRedfinUnitId(document, url);
}

export function selectedHomesUnitId(
  document: Document,
  url: URL,
): string | undefined {
  if (
    !/(^|\.)homes\.com$/i.test(url.hostname) ||
    !/\/property\//i.test(url.pathname)
  )
    return undefined;
  const route = url.hash.match(/^#([^#]+)-unit$/i)?.[1];
  if (route) return route;
  const header = document.querySelector(
    '.unit-floorplan-modal-header, [class*="unit-floorplan-modal-header"]',
  );
  const unitLabel =
    header?.querySelector('h1, h2, strong, [class*="unit-number"]')
      ?.textContent ?? header?.textContent;
  return unitLabel
    ?.replace(/\s+/g, ' ')
    .trim()
    .match(/^(\S+)/)?.[1];
}

export function appearsToBeHomesRental(document: Document, url: URL): boolean {
  if (!/(^|\.)homes\.com$/i.test(url.hostname)) return false;
  if (selectedHomesUnitId(document, url)) return true;
  const hasRentalHeading = [...document.querySelectorAll('h1, h2, h3')].some(
    (heading) =>
      /^(?:pricing and floor plans|apartment community)$/i.test(
        heading.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      ),
  );
  if (hasRentalHeading) return true;
  return [...document.querySelectorAll('span, div, p')].some((element) =>
    /^\$\s*[\d,]+\s*(?:per month|total monthly price)$/i.test(
      element.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    ),
  );
}

export function requiresHomesUnitSelection(
  document: Document,
  url: URL,
): boolean {
  if (!appearsToBeHomesRental(document, url)) return false;
  const hasFloorPlans = [...document.querySelectorAll('h1, h2, h3')].some(
    (heading) =>
      /^pricing and floor plans$/i.test(
        heading.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      ),
  );
  return hasFloorPlans && !selectedHomesUnitId(document, url);
}
