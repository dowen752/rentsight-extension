import {
  classifyIncludedUtilities,
  classifyLaundry,
  classifyNoPetsPolicy,
  listingValue,
  parseLabeledMoney,
  parseNumberNear,
  parseRentEvidence,
  parseUsAddress,
} from './parsers';
import { emptyExtraction, type ListingExtractor } from './types';

interface SelectedUnit {
  text: string;
  name?: string;
}

interface ZillowCalculatorCharge {
  amount: number;
  rawText: string;
}

function calculatorCharge(
  document: Document,
  rowClass: string,
  label: RegExp,
): ZillowCalculatorCharge | undefined {
  const row = document.querySelector(`.${rowClass}.fee-row`);
  if (!row) return undefined;
  const text = textWithNodeBoundaries(row);
  const parsed = parseLabeledMoney(text, label);
  return parsed && { amount: parsed.amount, rawText: text };
}

function textWithNodeBoundaries(element: Element): string {
  const parts: string[] = [];
  const visit = (node: Node) => {
    if (node.nodeType === node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) parts.push(text);
      return;
    }
    for (const child of node.childNodes) visit(child);
  };
  visit(element);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function selectedUnit(document: Document): SelectedUnit | undefined {
  for (const dialog of document.querySelectorAll(
    '[role="dialog"], [aria-modal="true"]',
  )) {
    const text = textWithNodeBoundaries(dialog);
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
    const calculatorBaseRent = calculatorCharge(
      document,
      'base-rent-fee',
      /(?:monthly )?base rent/i,
    );
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
    result.rent = calculatorBaseRent
      ? {
          kind: 'single',
          amount: listingValue(
            calculatorBaseRent.amount,
            0.92,
            calculatorBaseRent.rawText,
          ),
          rawText: calculatorBaseRent.rawText,
        }
      : parseRentEvidence(rentTexts, 0.86);
    if (result.rent?.kind === 'single')
      result.listing.recurring.advertisedRent = result.rent.amount;
    const factContainer = document.querySelector(
      '[data-testid="bed-bath-sqft-facts"], [aria-label="Bed bath sqft facts"], [data-testid="bed-bath-beyond"], [data-testid="facts-and-features"]',
    );
    const facts = selectedUnitRequested
      ? (detailText ?? '')
      : (detailText ??
        (factContainer ? textWithNodeBoundaries(factContainer) : undefined) ??
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
    const calculator = {
      baseRent: calculatorBaseRent,
      applicationFee: calculatorCharge(
        document,
        'application-fee',
        /application fee/i,
      ),
      administrativeFee: calculatorCharge(
        document,
        'administration-fee',
        /admin(?:istrative)? fee/i,
      ),
      securityDeposit: calculatorCharge(
        document,
        'security-deposit-fee',
        /security deposit/i,
      ),
      petRent: calculatorCharge(document, 'pet-rent-fee', /pet rent/i),
      petFee: calculatorCharge(document, 'pet-fee-fee', /pet fee/i),
      trash: calculatorCharge(document, 'garbage-fee-fee', /trash fee/i),
      utilityManagement: calculatorCharge(
        document,
        'utilities-monthly-fee-fee',
        /utility management fee/i,
      ),
    };
    const deposit =
      calculator.securityDeposit ??
      parseLabeledMoney(body, /security deposit/i);
    if (deposit)
      result.listing.upfront.securityDeposit = listingValue(
        deposit.amount,
        calculator.securityDeposit ? 0.9 : 0.72,
        deposit.rawText,
      );
    const descriptionText = pick(
      '[data-testid="description"], [data-test-id="description"]',
    );
    const propertyText = isApartmentCommunity
      ? communityText
      : `${body} ${descriptionText ?? ''}`;
    result.rawPetPolicyText = classifyNoPetsPolicy(propertyText);
    if (result.rawPetPolicyText) result.petPolicy = 'none';
    const proseApplicationFee = parseLabeledMoney(
      propertyText,
      /(?:application|screening) fee/i,
    );
    const proseAdministrativeFee = parseLabeledMoney(
      propertyText,
      /(?:administrative|admin) fee/i,
    );
    const prosePetRent = parseLabeledMoney(
      propertyText,
      /(?:monthly pet rent|pet rent)/i,
    );
    const proseUtilityManagement = parseLabeledMoney(
      propertyText,
      /utility management fee/i,
    );
    const applicationFee = calculator.applicationFee ?? proseApplicationFee;
    const administrativeFee =
      calculator.administrativeFee ?? proseAdministrativeFee;
    const petRent = calculator.petRent ?? prosePetRent;
    const petDeposit = parseLabeledMoney(propertyText, /pet deposit/i);
    const petFee =
      calculator.petFee ?? parseLabeledMoney(propertyText, /pet fee/i);
    for (const [label, structured, prose] of [
      ['application fee', calculator.applicationFee, proseApplicationFee],
      [
        'administrative fee',
        calculator.administrativeFee,
        proseAdministrativeFee,
      ],
      ['pet rent', calculator.petRent, prosePetRent],
      [
        'utility management fee',
        calculator.utilityManagement,
        proseUtilityManagement,
      ],
    ] as const) {
      if (structured && prose && structured.amount !== prose.amount)
        result.warnings.push(
          `Zillow's property-specific calculator and description list different ${label} amounts. The calculator value was used; confirm it with the housing provider.`,
        );
    }
    if (applicationFee)
      result.listing.upfront.applicationFee = listingValue(
        applicationFee.amount,
        calculator.applicationFee ? 0.9 : 0.7,
        applicationFee.rawText,
      );
    if (administrativeFee)
      result.listing.upfront.administrativeFee = listingValue(
        administrativeFee.amount,
        calculator.administrativeFee ? 0.9 : 0.68,
        administrativeFee.rawText,
      );
    if (petRent)
      result.listing.recurring.petRent = listingValue(
        petRent.amount,
        calculator.petRent ? 0.9 : 0.68,
        petRent.rawText,
      );
    if (petDeposit)
      result.listing.upfront.petDeposit = listingValue(
        petDeposit.amount,
        0.68,
        petDeposit.rawText,
      );
    if (petFee)
      result.listing.upfront.petFee = listingValue(
        petFee.amount,
        calculator.petFee ? 0.9 : 0.68,
        petFee.rawText,
      );
    if (calculator.trash)
      result.listing.recurring.trash = listingValue(
        calculator.trash.amount,
        0.9,
        calculator.trash.rawText,
      );
    if (calculator.utilityManagement)
      result.listing.recurring.otherRequiredMonthlyFees = listingValue(
        calculator.utilityManagement.amount,
        0.9,
        calculator.utilityManagement.rawText,
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
