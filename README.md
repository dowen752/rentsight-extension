# RentSight

RentSight is a Chrome Manifest V3 side-panel extension for extracting rental-listing details, editing transparent cost assumptions, estimating true housing costs, saving a shortlist, and comparing listings.

## Requirements

- Node.js 20 or newer
- npm 10 or newer
- Google Chrome with Side Panel support

## Install and verify

```bash
npm install
npm run lint
npx tsc -b
npm test
npm run build
```

The production extension is written to `dist/`.

## Load the unpacked extension

1. Build with `npm run build`.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose this project's `dist` directory.
5. Pin RentSight, navigate to an HTTP or HTTPS page, and click its toolbar icon to open the side panel.

After rebuilding, select **Reload** on the extension card in `chrome://extensions` and refresh the inspected page if necessary.

## Development

Run `npm run dev` for a watched development build. Vite rebuilds `dist/` when source files change; Chrome still requires the extension to be reloaded after changes to the service worker or manifest.

## Architecture

- `src/background`: service worker, tab coordination, and on-demand content-script injection
- `src/content`: page-context inspection and future DOM coordination
- `src/sidepanel`: React side-panel UI
- `src/calculations`: pure, browser-independent cost logic
- `src/storage`: typed wrapper over `chrome.storage.local`
- `src/shared`: message contracts and shared utilities
- `src/extractors`: adapters for individual listing sites
- `src/saved`: saved-record migrations, CRUD, comparison, and import/export
- `src/location`: geocoding, regional utility, benchmark, cache, and mock-backend provider interfaces
- `tests`: unit tests and sanitized HTML fixtures

Data flows from the active tab's layered extractor into a normalized, metadata-bearing listing. The side panel merges extraction into a persisted draft without replacing user values. Pure calculation functions materialize that analysis for results. Saving creates a separately versioned snapshot; comparisons recalculate snapshots rather than persisting derived totals. Location resolution is optional, cached, and provider-based, and unresolved locations leave national assumptions in place.

The manifest intentionally has no host permissions. Opening the extension grants temporary `activeTab` access, allowing the service worker to inject `content.js` only into the page the user chose to inspect. Chrome-internal pages cannot be inspected and surface a friendly error in the panel.

## Cost model and formulas

Every normalized listing value carries its source (`listing`, `user`, `location_estimate`, or `default`), a confidence from 0–1, and an optional note. Missing properties are unknown; an explicit value of zero means the cost is known to be free.

- **True monthly cost** = advertised rent + all known or estimated monthly utilities, services, pet rent, insurance, parking, laundry, amenities, and required fees.
- **Required move-in cash** = every upfront payment, including rent prepayments and refundable deposits.
- **Nonrefundable move-in expenses** = application + administrative + other move-in fees.
- **Refundable deposits** = security + pet + utility deposits. These affect cash required, not expense totals.
- **Effective monthly rent** = `(rent × (lease months − free months) − one-time credit) ÷ lease months`, floored at zero. Free months are capped at the lease duration.
- **First-year housing cost** = 12 × (effective rent + non-rent monthly costs) + nonrefundable move-in expenses. First/last-month prepayments are excluded because the year's rent already includes those months; refundable deposits are also excluded.
- **Cost per square foot** = true monthly cost ÷ square footage. It is unknown when square footage is missing or zero.

### Placeholder estimation assumptions

All temporary assumptions live in `src/calculations/assumptions.ts`. Baseline monthly amounts are electricity $90, natural gas $45, water $35, sewer $25, trash $25, internet $60, renters insurance $15, and paid shared laundry $24. Included utilities estimate to $0. Non-included utilities are adjusted by occupants (+15% after the first), bedrooms (+8% after the first), square footage (+5% per 500 square feet above 800), and housing type (apartment/condo 1.0×, townhouse 1.1×, single-family 1.2×). These defaults use deliberately low confidence and should be replaced by location-aware estimates later.

## Side-panel state and persistence

The side panel keeps one serializable analysis per listing URL in `chrome.storage.local`. Each analysis contains the normalized listing, its original extracted/default baseline, utility inclusion choices, occupancy and laundry details, and custom fees. User edits become sourced values with `source: user`; Reset restores the baseline. Untouched utility assumptions are recalculated from occupancy, bedrooms, and square footage, while user-entered amounts remain fixed. The UI materializes custom fees and paid-laundry usage into a normalized listing before invoking the pure calculation engine, so React and Chrome storage remain outside the calculation layer.

## Listing extractors

Extraction runs locally in the active tab, in priority order: JSON-LD, safely recognized embedded JSON state, a site adapter, and generic visible-text patterns. Rent ranges and conflicting prices are retained as evidence and are never silently converted to one rent. Extraction reruns after debounced SPA URL changes. Re-extraction updates the saved baseline but never replaces a field whose source is `user`.

To add another listing site:

1. Create a module in `src/extractors/` that implements `ListingExtractor` from `types.ts`.
2. Give it a stable `siteName` and `version`, a narrow `matches(url, document)` predicate, and an `extract(document, url)` implementation.
3. Use the shared parser helpers and `listingValue` so every field has listing source, confidence, and supporting text where applicable.
4. Add the adapter to `SITE_EXTRACTORS` in `src/extractors/index.ts`, ahead of the generic fallback.
5. Add anonymized HTML fixtures and tests for expected fields, missing data, ranges, and conflicting values. Do not make automated tests depend on the live site.

### Currently supported sites

- Zillow rental detail pages
- Apartments.com listing pages
- Generic rental pages through JSON-LD and visible-text fallback patterns

Site markup changes frequently. Extraction is best-effort, ambiguity is shown instead of guessed, and every value remains manually editable.

## Saved listings, comparison, and transfer

Saved analyses use versioned records in `chrome.storage.local`. Saving the same URL updates the existing record instead of creating a duplicate. Selected records can be compared, exported as RentSight JSON or CSV, and re-imported from RentSight JSON. Imports are validated and migrated before they reach storage. The comparison completeness percentage weights listing/user values above regional/default estimates and labels the result as **data completeness**, not a recommendation or quality score.

## Location estimates and external APIs

The default geocoder only parses city, state, and ZIP from entered or extracted US-style addresses. Regional utility factors come from `src/location/config.ts`; unknown states use the national 1.0 factor. Results are cached in Chrome storage, labeled as estimates, and remain editable. Mock providers cover geocoding, utility adjustments, and rent benchmarks. `MockBackendGeocodingProvider` is an optional developer adapter and is not required for the extension to function.

To add a real provider, implement the relevant interface in `src/location/types.ts`, construct it where the side panel currently selects local providers, and retain graceful fallback and cache behavior. Do not embed private API credentials in the extension bundle: browser extensions are public clients and their source can be inspected. Services requiring secret credentials must be called through a controlled backend or serverless function that authenticates requests, limits abuse, and returns only necessary data.

## Privacy considerations

RentSight performs listing extraction locally in the user-selected active tab and does not bulk scrape or automatically browse sites. Drafts, saved listings, and location cache entries stay in `chrome.storage.local` for the current Chrome profile unless the user explicitly exports them. The extension requests no broad host permission and includes no analytics, authentication bypass, CAPTCHA workaround, or production third-party API call. Exported files may contain addresses and financial assumptions; users should store and share them accordingly.

## Known limitations

- Extraction depends on third-party markup and may become incomplete when sites change.
- Generic text parsing supports common US listing formats but cannot resolve every ambiguous fee or address.
- Regional factors and rent benchmarks are placeholders, not live quotes or financial advice.
- The local address parser is US-oriented and does not provide coordinates for unknown addresses.
- Chrome local storage does not synchronize this shortlist across browsers or accounts.
- CSV is export-only; RentSight JSON is the supported round-trip format.
- Comparison pet expenses combine monthly pet rent and upfront pet deposits for visibility, but their timing differs.

## Suggested future work

- Production location, utility-rate, transit, climate, and local rent-data providers through a secure backend
- More listing-site adapters and fixture-driven regression coverage
- User-selectable estimation profiles and multi-year lease scenarios
- Encrypted or account-based synchronization
- Accessibility and manual cross-browser UI testing
- Home-purchase calculations covering mortgage payments, taxes, insurance, HOA fees, maintenance, closing cash, and rent-versus-buy comparisons
