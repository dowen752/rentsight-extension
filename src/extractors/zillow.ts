import {
  classifyIncludedUtilities,
  classifyLaundry,
  classifyNoPetsPolicy,
  listingValue,
  parseMoney,
  parseNumberNear,
  parseRentEvidence,
  parseUsAddress,
} from './parsers';
import { emptyExtraction, type ListingExtractor } from './types';

interface SelectedUnit {
  text: string;
  name?: string;
}

function selectedUnit(document: Document): SelectedUnit | undefined {
  for (const dialog of document.querySelectorAll(
    '[role="dialog"], [aria-modal="true"]',
  )) {
    const text = dialog.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    if (
      /\$[\d,]+/i.test(text) &&
      /\b(?:beds?|bd|studio)\b/i.test(text) &&
      /\b(?:baths?|ba)\b/i.test(text) &&
      /\b(?:sqft|sq\s*ft)\b/i.test(text)
    ) {
      const name = [...dialog.querySelectorAll('h1, h2, h3')]
        .map((heading) => heading.textContent?.replace(/\s+/g, ' ').trim())
        .find((heading) => heading && /^Unit\s+[\w-]+$/i.test(heading));
      return { text, name };
    }
  }
  const elements = [
    ...document.querySelectorAll('h1, h2, h3, span, p, div, li'),
  ];
  const normalized = (element: Element) =>
    element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const headingIndex = elements.findIndex((element) =>
    /^Unit\s+[\w-]+$/i.test(normalized(element)),
  );
  if (headingIndex < 0) return undefined;
  const summary = elements
    .map((element, index) => ({ index, text: normalized(element) }))
    .filter(
      ({ text }) =>
        text.length <= 240 &&
        /\$[\d,]+/i.test(text) &&
        /\b(?:beds?|bd|studio)\b/i.test(text) &&
        /\b(?:baths?|ba)\b/i.test(text),
    )
    .sort(
      (left, right) =>
        Math.abs(left.index - headingIndex) -
          Math.abs(right.index - headingIndex) ||
        left.text.length - right.text.length,
    )[0];
  if (!summary) return undefined;
  const sqft = elements
    .map((element, index) => ({ index, text: normalized(element) }))
    .filter(
      ({ text }) =>
        text.length <= 80 && /^[\d,]+\s*(?:sqft|sq\.?\s*ft)\.?$/i.test(text),
    )
    .sort(
      (left, right) =>
        Math.abs(left.index - summary.index) -
        Math.abs(right.index - summary.index),
    )[0]?.text;
  const name = normalized(elements[headingIndex]);
  return {
    name,
    text: [name, summary.text, sqft].filter(Boolean).join(' '),
  };
}

function visibleDetailText(document: Document): string | undefined {
  const elements = [
    ...document.querySelectorAll('h1, h2, h3, span, p, div, li'),
  ];
  const normalized = (element: Element) =>
    element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const candidates = elements.map((element, index) => ({
    index,
    text: normalized(element),
  }));
  const targetedPrice = document.querySelector(
    '[data-testid="price"], [data-test-id="price"]',
  );
  const targetedPriceIndex = targetedPrice
    ? elements.indexOf(targetedPrice)
    : -1;
  const price =
    (targetedPriceIndex >= 0
      ? candidates.find(({ index }) => index === targetedPriceIndex)
      : undefined) ??
    candidates
      .filter(({ text }) => /^\$[\d,]+(?:\.\d{2})?\s*\/\s*mo\b/i.test(text))
      .sort((left, right) => left.text.length - right.text.length)[0];
  if (!price) return undefined;
  const nearest = (pattern: RegExp) =>
    candidates
      .filter(({ text }) => text.length <= 80 && pattern.test(text))
      .sort(
        (left, right) =>
          Math.abs(left.index - price.index) -
            Math.abs(right.index - price.index) ||
          left.text.length - right.text.length,
      )[0]?.text;
  const bedrooms = nearest(/^(?:studio|\d+(?:\.\d+)?\s*(?:beds?|bd))$/i);
  const bathrooms = nearest(/^\d+(?:\.\d+)?\s*(?:baths?|ba)$/i);
  const squareFootage = nearest(/^[\d,]+\s*(?:sqft|sq\.?\s*ft)\.?$/i);
  if (!bedrooms || !bathrooms || !squareFootage) return undefined;
  return [price.text, bedrooms, bathrooms, squareFootage].join(' ');
}

function visibleAddressText(document: Document): string | undefined {
  const elements = [
    ...document.querySelectorAll('h1, h2, h3, address, span, p, div'),
  ];
  const normalized = (element: Element) =>
    element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const candidates = elements.map((element, index) => ({
    index,
    text: normalized(element),
  }));
  const targetedPrice = document.querySelector(
    '[data-testid="price"], [data-test-id="price"]',
  );
  const activeListing = targetedPrice?.closest(
    'main, article, [data-testid="home-details-content"], [data-test-id="home-details-content"]',
  );
  const targetedPriceIndex = targetedPrice
    ? elements.indexOf(targetedPrice)
    : -1;
  const priceIndex =
    (targetedPriceIndex >= 0 ? targetedPriceIndex : undefined) ??
    candidates.find(({ text }) =>
      /^\$[\d,]+(?:\.\d{2})?\s*\/\s*mo\b/i.test(text),
    )?.index;
  if (priceIndex === undefined) return undefined;
  return candidates
    .filter(
      ({ text }) => text.length <= 180 && parseUsAddress(text) !== undefined,
    )
    .sort(
      (left, right) =>
        Number(!activeListing?.contains(elements[left.index])) -
          Number(!activeListing?.contains(elements[right.index])) ||
        Math.abs(left.index - priceIndex) -
          Math.abs(right.index - priceIndex) ||
        left.text.length - right.text.length,
    )[0]?.text;
}

export const zillowExtractor: ListingExtractor = {
  siteName: 'Zillow',
  version: '1.1.0',
  matches(url) {
    return (
      /(^|\.)zillow\.com$/i.test(url.hostname) &&
      /\/(?:homedetails|apartments)\//i.test(url.pathname)
    );
  },
  extract(document, url) {
    const result = emptyExtraction(this.siteName, this.version);
    const pick = (selectors: string) =>
      document.querySelector(selectors)?.textContent?.trim();
    const isApartmentCommunity = /\/apartments\//i.test(url.pathname);
    const unit = isApartmentCommunity ? selectedUnit(document) : undefined;
    const unitText = unit?.text;
    const detailText = unitText ?? visibleDetailText(document);
    const selectedUnitRequested = /(?:^|#)rentsight-unit=/i.test(url.hash);
    if (selectedUnitRequested && !unitText) {
      result.warnings.push(
        'The selected Zillow unit layout could not be read safely. Enter its values manually.',
      );
    }
    const communityText =
      (document.body as HTMLElement).innerText ??
      [...document.body.querySelectorAll('h1, h2, h3, p, li, span, div')]
        .map((element) => element.textContent?.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join('\n');
    const body = detailText ?? communityText;
    const heading = pick('h1');
    const buildingTitle = pick(
      '[data-test-id="bdp-building-title"], [data-testid="bdp-building-title"]',
    );
    const explicitAddress = pick(
      '[data-test-id="bdp-building-address"], [data-testid="bdp-building-address"], [data-test-id="building-address"], [data-testid="building-address"], [data-testid="property-address"], .property-address',
    );
    const visibleAddress = !isApartmentCommunity
      ? visibleAddressText(document)
      : undefined;
    const parsedPageAddress = visibleAddress
      ? parseUsAddress(visibleAddress)
      : undefined;
    const addressText =
      explicitAddress ??
      (parsedPageAddress
        ? `${parsedPageAddress.fullAddress}, ${parsedPageAddress.city}, ${parsedPageAddress.state} ${parsedPageAddress.zipCode}`
        : !isApartmentCommunity
          ? heading
          : undefined);
    const parsedAddress =
      parsedPageAddress ??
      (addressText ? parseUsAddress(addressText) : undefined);
    const selectedUnitRent = detailText?.match(
      /(?:Monthly base rent\s*)?\$[\d,]+(?:\.\d{2})?/i,
    )?.[0];
    const rentTexts = selectedUnitRequested
      ? unitText && selectedUnitRent
        ? [selectedUnitRent]
        : []
      : detailText
        ? selectedUnitRent
          ? [selectedUnitRent]
          : []
        : [
            ...document.querySelectorAll(
              '[data-testid="price"], [data-test-id="price"], [data-testid="rent"], [data-testid*="rent-price"], [data-testid="rent-zestimate"], .ds-price',
            ),
          ].map((node) => node.textContent ?? '');
    if (isApartmentCommunity && (buildingTitle ?? heading)) {
      const title = buildingTitle ?? heading!;
      const displayTitle =
        unit?.name && title.toLowerCase() !== unit.name.toLowerCase()
          ? `${title} · ${unit.name}`
          : title;
      result.listing.identity.listingTitle = listingValue(
        displayTitle,
        buildingTitle ? 0.94 : 0.88,
        [title, unit?.name].filter(Boolean).join(' · '),
      );
    }
    if (parsedAddress) {
      result.listing.identity.fullAddress = listingValue(
        parsedAddress.fullAddress,
        0.88,
        addressText,
      );
      result.listing.identity.city = listingValue(
        parsedAddress.city,
        0.88,
        addressText,
      );
      result.listing.identity.state = listingValue(
        parsedAddress.state,
        0.88,
        addressText,
      );
      result.listing.identity.zipCode = listingValue(
        parsedAddress.zipCode,
        0.88,
        addressText,
      );
    } else if (explicitAddress ?? heading) {
      const address = explicitAddress ?? heading!;
      result.listing.identity.fullAddress = listingValue(
        address,
        0.72,
        address,
      );
    }
    result.rent = parseRentEvidence(rentTexts, 0.86);
    if (result.rent?.kind === 'single')
      result.listing.recurring.advertisedRent = result.rent.amount;
    const facts = selectedUnitRequested
      ? (detailText ?? '')
      : (detailText ??
        pick(
          '[data-testid="bed-bath-sqft-facts"], [aria-label="Bed bath sqft facts"], [data-testid="bed-bath-beyond"], [data-testid="facts-and-features"]',
        ) ??
        '');
    const beds = /\bstudio\b/i.test(facts)
      ? 0
      : /\d+(?:\.\d+)?\s*(?:-|–|—|to)\s*\d+(?:\.\d+)?\s*(?:beds?|bd)(?=[\s,|·]|\d|$)/i.test(
            facts,
          )
        ? undefined
        : parseNumberNear(
            facts,
            /(\d+(?:\.\d+)?)\s*(?:beds?|bd)(?=[\s,|·]|\d|$)/i,
          );
    const baths = parseNumberNear(
      facts,
      /(\d+(?:\.\d+)?)\s*(?:baths?|ba)(?=[\s,|·]|\d|$)/i,
    );
    const sqft = parseNumberNear(
      facts,
      /([\d,]+)\s*(?:sq\.?\s*ft|sqft)(?=[\s,|·]|\d|$)/i,
    );
    if (beds !== undefined)
      result.listing.identity.bedrooms = listingValue(beds, 0.84, facts);
    if (baths !== undefined)
      result.listing.identity.bathrooms = listingValue(baths, 0.84, facts);
    if (sqft !== undefined)
      result.listing.identity.squareFootage = listingValue(sqft, 0.84, facts);
    const deposit = body.match(/security deposit[^.\n]*\$[\d,]+/i)?.[0];
    if (deposit)
      result.listing.upfront.securityDeposit = listingValue(
        parseMoney(deposit)!,
        0.72,
        deposit,
      );
    const descriptionText = pick(
      '[data-testid="description"], [data-test-id="description"]',
    );
    const propertyText = isApartmentCommunity
      ? communityText
      : `${body} ${descriptionText ?? ''}`;
    result.rawPetPolicyText = classifyNoPetsPolicy(propertyText);
    if (result.rawPetPolicyText) result.petPolicy = 'none';
    const applicationFee = propertyText.match(
      /(?:application|screening) fee[^.\n]{0,80}\$[\d,]+/i,
    )?.[0];
    const administrativeFee = propertyText.match(
      /(?:administrative|admin) fee[^.\n]{0,80}\$[\d,]+/i,
    )?.[0];
    const petRent = propertyText.match(
      /(?:monthly pet rent|pet rent)[^.\n]{0,80}\$[\d,]+/i,
    )?.[0];
    const petDeposit = propertyText.match(
      /pet deposit[^.\n]{0,80}\$[\d,]+/i,
    )?.[0];
    if (applicationFee)
      result.listing.upfront.applicationFee = listingValue(
        parseMoney(applicationFee)!,
        0.7,
        applicationFee,
      );
    if (administrativeFee)
      result.listing.upfront.administrativeFee = listingValue(
        parseMoney(administrativeFee)!,
        0.68,
        administrativeFee,
      );
    if (petRent)
      result.listing.recurring.petRent = listingValue(
        parseMoney(petRent)!,
        0.68,
        petRent,
      );
    if (petDeposit)
      result.listing.upfront.petDeposit = listingValue(
        parseMoney(petDeposit)!,
        0.68,
        petDeposit,
      );
    result.includedUtilities = classifyIncludedUtilities(propertyText);
    result.rawUtilityText =
      propertyText.match(
        /[^.\n]*(?:all utilities(?:\s+and\s+[^.;\n]{1,80})?\s+(?:are\s+)?included|includ(?:e|es|ed|ing)\s+all utilities|(?:landlord|owner)\s+pays(?:\s+for)?\s+[^.\n]+)[^.\n]*/i,
      )?.[0] ??
      propertyText.match(
        /[^.\n]*(?:utilities?\s+(?:are\s+)?included|\b(?:electricity|gas|water|sewer|trash|internet|wi-?fi)\b[^.\n]*\bincluded\b)[^.\n]*/i,
      )?.[0];
    result.laundryType = classifyLaundry(
      isApartmentCommunity
        ? `${detailText ?? ''} ${communityText}`
        : communityText,
    );
    return result;
  },
};
