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

function selectedUnit(document: Document): Element | undefined {
  return (
    document.querySelector(
      '.unit-floorplan-modal, [class*="unit-floorplan-modal"][role="dialog"], [role="dialog"] .unit-floorplan-modal-body',
    ) ?? undefined
  );
}

function shortFragments(document: Document): string[] {
  return [
    ...new Set(
      [...document.querySelectorAll('h1, h2, h3, p, span, div')]
        .map((node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '')
        .filter((text) => text.length > 0 && text.length <= 140),
    ),
  ];
}

export const homesExtractor: ListingExtractor = {
  siteName: 'Homes.com',
  version: '1.0.1',
  matches(url) {
    return (
      /(^|\.)homes\.com$/i.test(url.hostname) &&
      /\/property\//i.test(url.pathname)
    );
  },
  extract(document, url) {
    const result = emptyExtraction(this.siteName, this.version);
    const unit = selectedUnit(document);
    const selectedUnitRequested =
      /(?:^|#)rentsight-unit=/i.test(url.hash) || /-unit$/i.test(url.hash);
    if (selectedUnitRequested && !unit) {
      result.warnings.push(
        'The selected Homes.com unit details have not loaded yet. Reopen the unit and try again.',
      );
      return result;
    }

    const pick = (selectors: string) =>
      document
        .querySelector(selectors)
        ?.textContent?.replace(/\s+/g, ' ')
        .trim();
    const unitText = unit?.textContent?.replace(/\s+/g, ' ').trim();
    const amenityText = unit
      ? [...unit.querySelectorAll('.amenity-item, [class*="amenity-item"]')]
          .map((item) => item.textContent?.trim())
          .filter(Boolean)
          .join(' · ')
      : '';
    const body = `${unitText ?? document.body.textContent ?? ''} ${amenityText}`;
    result.rawPetPolicyText = classifyNoPetsPolicy(body);
    if (result.rawPetPolicyText) result.petPolicy = 'none';
    const fragments = unit ? [] : shortFragments(document);
    const title = pick(
      'h1, [class*="property-name"], [class*="community-name"]',
    );
    if (title)
      result.listing.identity.listingTitle = listingValue(title, 0.84, title);

    const addressText = pick(
      '[class*="property-address"], [data-testid="property-address"], address',
    );
    const street = fragments.find((text) =>
      /^\d{1,6}\s+.+\b(?:st(?:reet)?|rd|road|ave(?:nue)?|blvd|boulevard|dr(?:ive)?|ln|lane|ct|court|way|pl(?:ace)?|pkwy|parkway|cir(?:cle)?)(?:\s+(?:unit|apt|#)\s*[\w-]+)?$/i.test(
        text,
      ),
    );
    const locality = fragments.find((text) =>
      /^[A-Za-z .'-]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?$/i.test(text),
    );
    const combinedAddress =
      addressText ??
      (street && locality ? `${street}, ${locality}` : undefined);
    const address = combinedAddress
      ? parseUsAddress(combinedAddress)
      : undefined;
    if (address) {
      result.listing.identity.fullAddress = listingValue(
        address.fullAddress,
        0.88,
        combinedAddress,
      );
      result.listing.identity.city = listingValue(address.city, 0.88);
      result.listing.identity.state = listingValue(address.state, 0.88);
      result.listing.identity.zipCode = listingValue(address.zipCode, 0.88);
    } else if (addressText) {
      result.listing.identity.fullAddress = listingValue(
        addressText,
        0.7,
        addressText,
      );
    }

    const rentTexts = unit
      ? [...unit.querySelectorAll('.price-range, [class*="price-range"]')].map(
          (node) => node.textContent ?? '',
        )
      : [
          ...[
            ...document.querySelectorAll(
              '[class*="price-range"], [class*="base-price"], [data-testid="rent"]',
            ),
          ].map((node) => node.textContent ?? ''),
          ...fragments.filter((text) =>
            /^\$\s*[\d,]+\s*(?:per month|total monthly price)$/i.test(text),
          ),
        ];
    result.rent = parseRentEvidence(rentTexts, unit ? 0.94 : 0.82);
    if (result.rent?.kind === 'single')
      result.listing.recurring.advertisedRent = result.rent.amount;

    const facts = unitText ?? fragments.join(' · ');
    const explicitBeds = parseNumberNear(
      facts,
      /(\d+(?:\.\d+)?)\s*(?:beds?|bedrooms?|bd)\b/i,
    );
    const beds = explicitBeds ?? (/studio/i.test(facts) ? 0 : undefined);
    const baths = parseNumberNear(
      facts,
      /(\d+(?:\.\d+)?)\s*(?:baths?|bathrooms?|ba)\b/i,
    );
    const sqft = parseNumberNear(
      facts,
      /([\d,]+)\s*(?:sq\.?\s*ft|sqft|square feet)\b/i,
    );
    if (beds !== undefined)
      result.listing.identity.bedrooms = listingValue(beds, 0.92, facts);
    if (baths !== undefined)
      result.listing.identity.bathrooms = listingValue(baths, 0.92, facts);
    if (sqft !== undefined)
      result.listing.identity.squareFootage = listingValue(sqft, 0.92, facts);

    const depositText = unit
      ?.querySelector('.deposit-amount, [class*="deposit-amount"]')
      ?.textContent?.trim();
    const deposit = depositText ? parseMoney(depositText) : undefined;
    if (deposit !== undefined)
      result.listing.upfront.securityDeposit = listingValue(
        deposit,
        0.94,
        depositText,
      );

    const petDepositText = body.match(
      /\bpet deposit\s*(?::|-)?\s*\$[\d,]+(?:\.\d{2})?/i,
    )?.[0];
    if (petDepositText)
      result.listing.upfront.petDeposit = listingValue(
        parseMoney(petDepositText)!,
        0.9,
        petDepositText,
      );

    const specialText = unit
      ?.querySelector('.mf-rent-specials, [class*="rent-specials"]')
      ?.textContent?.replace(/\s+/g, ' ')
      .trim();
    const credit = specialText?.match(/\$[\d,]+(?=\s+in\s+free\s+rent)/i)?.[0];
    const creditAmount = credit ? parseMoney(credit) : undefined;
    if (creditAmount !== undefined)
      (result.listing.concessions ??= {}).oneTimeCredit = listingValue(
        creditAmount,
        0.82,
        specialText,
      );

    result.includedUtilities = classifyIncludedUtilities(body);
    result.laundryType = /washer\s*(?:\/|and|&)\s*dryer/i.test(amenityText)
      ? 'in_unit'
      : /laundry[^.\n]{0,80}hook-?ups?/i.test(body)
        ? 'hookups_only'
        : classifyLaundry(body);
    result.rawLaundryText = body.match(
      /[^.\n]*(?:laundry|washer|dryer)[^.\n]*/i,
    )?.[0];
    return result;
  },
};
