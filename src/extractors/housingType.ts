import type { HousingType, SourcedValue } from '../calculations';
import { listingValue } from './parsers';

export function parseHousingType(text: string): HousingType | undefined {
  const value = text
    .trim()
    .toLowerCase()
    .replace(/[-_\s]+/g, ' ');
  if (/^(townhouse|townhome|town house|town home)$/.test(value))
    return 'townhouse';
  if (
    /^(single family|single family home|single family residence|singlefamilyresidence|house)$/.test(
      value,
    )
  )
    return 'single_family';
  if (/^(apartment|apartments|apartmentcomplex)$/.test(value))
    return 'apartment';
  if (/^(condo|condominium)$/.test(value)) return 'condo';
  return undefined;
}

/** Read explicit listing facts, never infer type from marketing prose or URLs. */
export function extractHousingType(
  document: Document,
): SourcedValue<HousingType> | undefined {
  const candidates = new Map<HousingType, string>();
  for (const node of document.querySelectorAll(
    '[data-testid*="home-type"], [data-testid*="homeType"], [data-testid*="property-type"], [data-test*="home-type"], dt, li, p, span, div',
  )) {
    if (
      node.closest(
        'nav, footer, aside, [data-testid*="card"], [data-test*="card"]',
      )
    )
      continue;
    const text = node.textContent?.trim().replace(/\s+/g, ' ') ?? '';
    if (text.length > 100) continue;
    const labeled = text.match(/^(?:property|home|housing) type\s*:?\s*(.+)$/i);
    const sibling = /^(?:property|home|housing) type\s*:?$/i.test(text)
      ? node.nextElementSibling?.textContent?.trim()
      : undefined;
    const isFact =
      node.matches(
        '[data-testid*="home-type"], [data-testid*="homeType"], [data-testid*="property-type"], [data-test*="home-type"]',
      ) ||
      Boolean(
        node.closest(
          '[data-testid="home-facts"], [data-test-id="home-facts"], .home-facts, .property-facts',
        ),
      );
    const type = parseHousingType(
      labeled?.[1] ?? sibling ?? (isFact ? text : ''),
    );
    if (type) candidates.set(type, text);
  }
  if (candidates.size !== 1) return undefined;
  const [type, text] = [...candidates][0];
  return listingValue(type, 0.85, text);
}
