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
    '#floor-plan-modal, [data-tid="floorplan-modal"], [data-tid="floor-plan-modal"], dialog[open], [role="dialog"]',
  );

const exactMoney = /^\$\s*[\d,]+(?:\.\d{1,2})?(?:\s*\/\s*mo(?:nth)?)?$/i;
const exactSquareFeet = /^[\d,]+\s*(?:sq\.?\s*ft|sqft|square feet)$/i;

function firstAvailableUnit(
  document: Document,
  modal: Element | null,
): { priceText: string; squareFeetText?: string } | undefined {
  const root = modal ?? document.body;
  const explicitAvailability = root?.querySelector(
    '[data-tag_section="availability"], [data-tag_item="content-section"][aria-label*="availability" i]',
  );
  const availabilityHeading = [...(root?.querySelectorAll('*') ?? [])].find(
    (node) =>
      /^\d+\s+units?\s+available(?:\s+now)?$/i.test(compactText(node) ?? ''),
  );
  let availability = explicitAvailability ?? availabilityHeading?.parentElement;

  // Rent.com's current modal does not expose a stable availability selector.
  // Walk out from its "Units Available" heading until the unit rows appear.
  while (
    availability &&
    availability !== root &&
    ![...availability.querySelectorAll('*')].some((node) =>
      exactMoney.test(compactText(node) ?? ''),
    )
  )
    availability = availability.parentElement;

  if (!availability) return undefined;
  const leafTexts = [...availability.querySelectorAll('*')]
    .filter((node) => node.children.length === 0)
    .map((node) => compactText(node))
    .filter((text): text is string => Boolean(text));
  const priceText = leafTexts.find((text) => exactMoney.test(text));
  if (!priceText) return undefined;
  return {
    priceText,
    squareFeetText: leafTexts.find((text) => exactSquareFeet.test(text)),
  };
}

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
  version: '1.3.0',
  matches(url) {
    return (
      /(^|\.)rent\.com$/i.test(url.hostname) &&
      /\/(?:r|apartment)\//i.test(url.pathname)
    );
  },
  extract(document) {
    const result = emptyExtraction(this.siteName, this.version);
    const modal = floorPlanModal(document);
    const availableUnit = firstAvailableUnit(document, modal);
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

    // Rent.com does not provide a selectable unit detail page. Treat the first
    // displayed availability row as the current unit and read its leaf fields
    // separately so adjacent rent and square-footage text cannot concatenate.
    const priceText =
      availableUnit?.priceText ??
      textOf(document, '[data-tid="pdpKeyInfo_price"]');
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
    const sqft = parseNumberNear(
      availableUnit?.squareFeetText ?? facts,
      /([\d,]+)\s*(?:sq\.?\s*ft|sqft|square feet)\b/i,
    );
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
