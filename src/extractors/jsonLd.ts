import { parseHousingType } from './housingType';
import { emptyExtraction, type ListingExtraction } from './types';
import { listingValue, parseRentEvidence } from './parsers';

type JsonObject = Record<string, unknown>;
const object = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null;
const text = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;
const number = (value: unknown): number | undefined =>
  typeof value === 'number'
    ? value
    : typeof value === 'string' &&
        value.trim() !== '' &&
        Number.isFinite(Number(value))
      ? Number(value)
      : undefined;

function nodes(value: unknown): JsonObject[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!object(value)) return [];
  return Array.isArray(value['@graph'])
    ? value['@graph'].flatMap(nodes)
    : [value];
}

const normalizedIdentity = (value: string) =>
  decodeURIComponent(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

function matchesActiveListing(node: JsonObject, pageUrl?: URL): boolean {
  if (!pageUrl) return true;
  const nodeUrl = text(node.url) ?? text(node['@id']);
  if (nodeUrl) {
    try {
      const candidate = new URL(nodeUrl, pageUrl);
      if (
        candidate.hostname === pageUrl.hostname &&
        candidate.pathname !== pageUrl.pathname
      )
        return false;
    } catch {
      // Non-URL schema identifiers provide no useful listing scope.
    }
  }
  const address = object(node.address) ? node.address : undefined;
  const street = text(address?.streetAddress);
  const pathIdentity = normalizedIdentity(pageUrl.pathname);
  const streetIdentity = street ? normalizedIdentity(street) : '';
  const pathNumber = pathIdentity.match(/\b\d{1,6}\b/)?.[0];
  const streetNumber = streetIdentity.match(/^\d{1,6}\b/)?.[0];
  if (pathNumber && streetNumber && pathNumber !== streetNumber) return false;
  return true;
}

export function extractJsonLd(
  document: Document,
  pageUrl?: URL,
): ListingExtraction {
  const result = emptyExtraction('Structured JSON-LD', '1.0.0');
  const listing = result.listing;
  const rentTexts: string[] = [];
  for (const script of document.querySelectorAll<HTMLScriptElement>(
    'script[type="application/ld+json"]',
  )) {
    try {
      const source = script.textContent ?? '';
      if (source.length > 1_000_000) {
        result.warnings.push('An unusually large JSON-LD block was skipped.');
        continue;
      }
      for (const node of nodes(JSON.parse(source))) {
        if (!matchesActiveListing(node, pageUrl)) continue;
        const housingType = parseHousingType(text(node['@type']) ?? '');
        if (housingType && node.address)
          listing.identity.housingType ??= listingValue(housingType, 0.9);
        const address = object(node.address) ? node.address : undefined;
        const floorSize = object(node.floorSize)
          ? node.floorSize.value
          : node.floorSize;
        const offers = Array.isArray(node.offers)
          ? node.offers
          : node.offers
            ? [node.offers]
            : [];
        listing.identity.listingTitle ??= text(node.name)
          ? listingValue(text(node.name)!, 0.9)
          : undefined;
        listing.identity.fullAddress ??= text(address?.streetAddress)
          ? listingValue(text(address?.streetAddress)!, 0.92)
          : undefined;
        listing.identity.city ??= text(address?.addressLocality)
          ? listingValue(text(address?.addressLocality)!, 0.92)
          : undefined;
        listing.identity.state ??= text(address?.addressRegion)
          ? listingValue(text(address?.addressRegion)!, 0.92)
          : undefined;
        listing.identity.zipCode ??= text(address?.postalCode)
          ? listingValue(text(address?.postalCode)!, 0.92)
          : undefined;
        const bedrooms = number(node.numberOfBedrooms ?? node.numberOfRooms);
        const bathrooms = number(
          node.numberOfBathroomsTotal ?? node.numberOfBathrooms,
        );
        const squareFootage = number(floorSize);
        if (bedrooms !== undefined)
          listing.identity.bedrooms ??= listingValue(bedrooms, 0.88);
        if (bathrooms !== undefined)
          listing.identity.bathrooms ??= listingValue(bathrooms, 0.88);
        if (squareFootage !== undefined)
          listing.identity.squareFootage ??= listingValue(squareFootage, 0.88);
        for (const offer of offers) {
          if (!object(offer)) continue;
          const price = offer.price;
          const low = number(offer.lowPrice);
          const high = number(offer.highPrice);
          if (low !== undefined && high !== undefined)
            rentTexts.push(`$${low} - $${high}`);
          else if (price !== undefined) rentTexts.push(`$${String(price)}`);
        }
      }
    } catch {
      result.warnings.push('A JSON-LD block could not be parsed.');
    }
  }
  result.rent = parseRentEvidence(rentTexts, 0.92);
  if (result.rent?.kind === 'single')
    listing.recurring.advertisedRent = result.rent.amount;
  return result;
}
