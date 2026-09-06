import {
  classifyIncludedUtilities,
  classifyLaundry,
  classifyNoPetsPolicy,
  listingValue,
  parseMoney,
  parseNumberNear,
  parseUsAddress,
} from './parsers';
import { emptyExtraction, type ListingExtractor } from './types';

const textOf = (document: Document, selector: string): string | undefined =>
  document.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();

const sectionText = (document: Document, name: string): string | undefined =>
  textOf(document, `[id="listing-section-body-${name}"]`);

const compactText = (node: Element | null | undefined): string | undefined =>
  node?.textContent?.replace(/\s+/g, ' ').trim() || undefined;

const floorPlanModal = (document: Document): Element | null =>
  document.querySelector(
    '#floor-plan-modal, [data-tid="floorplan-modal"], [data-tid="floor-plan-modal"]',
  );

const moneyFor = (
  text: string,
  label: RegExp,
): [number, string] | undefined => {
  const match =
    text.match(
      new RegExp(
        `${label.source}[^$]{0,80}\\$\\s*[\\d,]+(?:\\.\\d{1,2})?`,
        'i',
      ),
    )?.[0] ??
    text.match(
      new RegExp(
        `\\$\\s*[\\d,]+(?:\\.\\d{1,2})?[^$]{0,40}${label.source}`,
        'i',
      ),
    )?.[0];
  const amount = match ? parseMoney(match) : undefined;
  return amount === undefined || !match ? undefined : [amount, match];
};

export const rentExtractor: ListingExtractor = {
  siteName: 'Rent.com',
  version: '1.2.0',
  matches(url) {
    return (
      /(^|\.)rent\.com$/i.test(url.hostname) &&
      /\/(?:r|apartment)\//i.test(url.pathname)
    );
  },
  extract(document) {
    const result = emptyExtraction(this.siteName, this.version);
    const modal = floorPlanModal(document);
    const title = textOf(
      document,
      '[data-tid="property_title"], [data-tid="property-title"]',
    );
    const locality = textOf(document, '[data-tid="pdpKeyInfo_address"]');
    const combinedAddress =
      title && locality ? `${title}, ${locality}` : undefined;
    const address = combinedAddress
      ? parseUsAddress(combinedAddress)
      : undefined;

    if (title)
      result.listing.identity.listingTitle = listingValue(title, 0.95, title);
    if (address) {
      result.listing.identity.fullAddress = listingValue(
        address.fullAddress,
        0.95,
        combinedAddress,
      );
      result.listing.identity.city = listingValue(address.city, 0.95);
      result.listing.identity.state = listingValue(address.state, 0.95);
      result.listing.identity.zipCode = listingValue(address.zipCode, 0.95);
    }

    const availabilityText = compactText(
      modal?.querySelector(
        '[data-tag_section="availability"], [data-tag_item="content-section"][aria-label*="availability" i]',
      ),
    );
    const availabilityPrices = [
      ...(availabilityText?.matchAll(/\$\s*[\d,]+(?:\.\d{1,2})?/g) ?? []),
    ]
      .map((match) => ({ rawText: match[0], amount: parseMoney(match[0]) }))
      .filter(
        (item): item is { rawText: string; amount: number } =>
          item.amount !== undefined,
      );
    // A floor plan may contain several available units. RentSight's single
    // advertised-rent field uses the lowest currently offered unit price,
    // matching Rent.com's floor-plan summary (for example, "$3,149+").
    const modalPriceText = availabilityPrices.sort(
      (left, right) => left.amount - right.amount,
    )[0]?.rawText;
    const priceText =
      modalPriceText ?? textOf(document, '[data-tid="pdpKeyInfo_price"]');
    const rent = priceText ? parseMoney(priceText) : undefined;
    if (rent !== undefined) {
      const amount = listingValue(rent, 0.96, priceText);
      result.rent = { kind: 'single', amount, rawText: priceText! };
      result.listing.recurring.advertisedRent = amount;
    }

    const modalHeader = modal?.querySelector('h2')?.parentElement;
    const modalFacts = [...(modalHeader?.querySelectorAll('p') ?? [])]
      .map((node) => compactText(node))
      .find((text) => text && /\b(?:bd|bed|ba|bath|sqft)\b/i.test(text));
    const facts =
      modalFacts ??
      [
        textOf(document, '[data-tid="pdpKeyInfo_bedText"]'),
        textOf(document, '[data-tid="pdpKeyInfo_bathText"]'),
        textOf(document, '[data-tid="pdpKeyInfo_sqFt"]'),
      ]
        .filter(Boolean)
        .join(' · ');
    const beds = parseNumberNear(facts, /(\d+(?:\.\d+)?)\s*(?:bd|beds?)\b/i);
    const baths = parseNumberNear(facts, /(\d+(?:\.\d+)?)\s*(?:ba|baths?)\b/i);
    const sqft = parseNumberNear(facts, /([\d,]+)\s*sqft\b/i);
    if (beds !== undefined)
      result.listing.identity.bedrooms = listingValue(beds, 0.96, facts);
    if (baths !== undefined)
      result.listing.identity.bathrooms = listingValue(baths, 0.96, facts);
    if (sqft !== undefined)
      result.listing.identity.squareFootage = listingValue(sqft, 0.96, facts);

    const amenityText = [
      ...document.querySelectorAll('[data-tid="amenity-highlight"]'),
    ]
      .map((node) => node.textContent?.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' · ');
    const aboutText = sectionText(document, 'About-This-Property') ?? '';
    const petText = sectionText(document, 'Pet-Policy') ?? '';
    const amenitiesText =
      sectionText(document, 'Amenities-and-Features') ?? amenityText;
    const body = document.body?.textContent ?? '';
    result.includedUtilities = classifyIncludedUtilities(body);
    result.laundryType = /washer\s*(?:\/|and|&)\s*dryer/i.test(amenitiesText)
      ? 'in_unit'
      : (classifyLaundry(amenitiesText) ?? classifyLaundry(body));
    result.rawLaundryText = amenitiesText.match(
      /[^·]*(?:laundry|washer|dryer)[^·]*/i,
    )?.[0];

    if (petText) {
      result.rawPetPolicyText = petText;
      if (classifyNoPetsPolicy(petText)) result.petPolicy = 'none';
    }

    const securityDeposit = moneyFor(aboutText, /security deposit/);
    const petDeposit =
      moneyFor(petText, /(?:refundable\s+)?(?:pet\s+)?deposit/) ??
      moneyFor(aboutText, /(?:refundable\s+)?pet deposit/);
    const petRent = moneyFor(petText, /(?:cat|dog|pet) rent/);
    const applicationFee = moneyFor(aboutText, /application fee/);
    const administrativeFee = moneyFor(aboutText, /administration fee/);
    if (securityDeposit)
      result.listing.upfront.securityDeposit = listingValue(
        securityDeposit[0],
        0.9,
        securityDeposit[1],
      );
    if (petDeposit)
      result.listing.upfront.petDeposit = listingValue(
        petDeposit[0],
        0.9,
        petDeposit[1],
      );
    if (petRent)
      result.listing.recurring.petRent = listingValue(
        petRent[0],
        0.9,
        petRent[1],
      );
    if (applicationFee)
      result.listing.upfront.applicationFee = listingValue(
        applicationFee[0],
        0.88,
        applicationFee[1],
      );
    if (administrativeFee)
      result.listing.upfront.administrativeFee = listingValue(
        administrativeFee[0],
        0.88,
        administrativeFee[1],
      );

    return result;
  },
};
