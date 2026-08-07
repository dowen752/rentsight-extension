import { emptyExtraction, type ListingExtraction } from './types';
import { listingValue, parseRentEvidence } from './parsers';

type JsonObject = Record<string, unknown>;
const MAX_EMBEDDED_JSON_BYTES = 1_000_000;
const MAX_VISITED_NODES = 20_000;
const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function findListing(
  value: unknown,
  budget: { remaining: number },
  depth = 0,
): JsonObject | undefined {
  budget.remaining -= 1;
  if (budget.remaining < 0) return undefined;
  if (depth > 8) return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findListing(item, budget, depth + 1);
      if (found) return found;
    }
    return undefined;
  }
  if (!isObject(value)) return undefined;
  const keys = Object.keys(value);
  if (
    keys.some((key) => /address/i.test(key)) &&
    keys.some((key) => /(?:rent|price)/i.test(key))
  )
    return value;
  for (const child of Object.values(value)) {
    const found = findListing(child, budget, depth + 1);
    if (found) return found;
  }
  return undefined;
}

function getString(object: JsonObject, names: string[]): string | undefined {
  for (const name of names)
    if (typeof object[name] === 'string') return object[name];
  return undefined;
}

function getNumber(object: JsonObject, names: string[]): number | undefined {
  for (const name of names) {
    const value = object[name];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (
      typeof value === 'string' &&
      value.trim() &&
      Number.isFinite(Number(value))
    )
      return Number(value);
  }
  return undefined;
}

export function extractEmbeddedData(document: Document): ListingExtraction {
  const result = emptyExtraction('Embedded listing data', '1.0.0');
  const scripts = document.querySelectorAll<HTMLScriptElement>(
    'script#__NEXT_DATA__, script[type="application/json"][data-hypernova-key], script#__APOLLO_STATE__',
  );
  for (const script of scripts) {
    try {
      const source = script.textContent ?? '';
      if (source.length > MAX_EMBEDDED_JSON_BYTES) {
        result.warnings.push(
          'An unusually large embedded-data block was skipped.',
        );
        continue;
      }
      const found = findListing(JSON.parse(source), {
        remaining: MAX_VISITED_NODES,
      });
      if (!found) continue;
      const addressValue = found.address;
      const address =
        typeof addressValue === 'string'
          ? addressValue
          : isObject(addressValue)
            ? getString(addressValue, [
                'streetAddress',
                'street',
                'fullAddress',
              ])
            : undefined;
      const city = isObject(addressValue)
        ? getString(addressValue, ['city', 'addressLocality'])
        : undefined;
      const state = isObject(addressValue)
        ? getString(addressValue, ['state', 'addressRegion'])
        : undefined;
      const zip = isObject(addressValue)
        ? getString(addressValue, ['zipcode', 'zipCode', 'postalCode'])
        : undefined;
      if (address)
        result.listing.identity.fullAddress = listingValue(address, 0.82);
      if (city) result.listing.identity.city = listingValue(city, 0.82);
      if (state) result.listing.identity.state = listingValue(state, 0.82);
      if (zip) result.listing.identity.zipCode = listingValue(zip, 0.82);
      const price = getNumber(found, ['rent', 'price', 'monthlyRent']);
      const low = getNumber(found, ['minRent', 'lowPrice']);
      const high = getNumber(found, ['maxRent', 'highPrice']);
      result.rent = parseRentEvidence(
        low !== undefined && high !== undefined
          ? [`$${low} - $${high}`]
          : price !== undefined
            ? [`$${price}`]
            : [],
        0.8,
      );
      if (result.rent?.kind === 'single')
        result.listing.recurring.advertisedRent = result.rent.amount;
      for (const [names, key] of [
        [['bedrooms', 'beds'], 'bedrooms'],
        [['bathrooms', 'baths'], 'bathrooms'],
        [['livingArea', 'squareFeet', 'sqft'], 'squareFootage'],
      ] as const) {
        const amount = getNumber(found, [...names]);
        if (amount !== undefined)
          result.listing.identity[key] = listingValue(amount, 0.8);
      }
      break;
    } catch {
      result.warnings.push(
        'Recognized embedded listing data could not be parsed.',
      );
    }
  }
  return result;
}
