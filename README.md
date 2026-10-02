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

`npm run build` also creates the independently bundled hosted-auth deployment in
`dist-auth/`. The two directories are separate build graphs and have different
deployment targets.

## Load the unpacked extension

1. Build with `npm run build`.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose this project's `dist` directory.
5. Pin RentSight, navigate to an HTTP or HTTPS page, and click its toolbar icon to open the side panel.

After rebuilding, select **Reload** on the extension card in `chrome://extensions` and refresh the inspected page if necessary.

## Package for the Chrome Web Store

Run a clean production build, then create the upload ZIP from inside `dist/`:

```bash
npm run build
rm -f rentsight-extension.zip
(cd dist && zip -r ../rentsight-extension.zip . -x '*.DS_Store')
unzip -l rentsight-extension.zip
```

Upload `rentsight-extension.zip` as the new Chrome Web Store package. The ZIP
must contain the contents of `dist/` at its root (including `manifest.json`) and
must not contain the `dist/` directory itself, `dist-auth/`, `auth-host.html`, or
`authHost.js`. The build verifier rejects hosted-auth files and known
Google/reCAPTCHA remote script loaders in any JavaScript emitted under `dist/`.
`dist-auth/` is a separate Cloudflare deployment artifact and must never be
included in the Web Store ZIP.

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
- `src/backend`: typed RentSight Cloud entitlement and billing client
- `tests`: unit tests and sanitized HTML fixtures

Data flows from the active tab's layered extractor into a normalized, metadata-bearing listing. The side panel merges extraction into a persisted draft without replacing user values. Pure calculation functions materialize that analysis for results. Saving creates a separately versioned snapshot; comparisons recalculate snapshots rather than persisting derived totals. Location resolution is optional, cached, and provider-based, and unresolved locations leave national assumptions in place.

The manifest grants required access only to the RentSight API and authentication origins. Opening the extension grants temporary `activeTab` access, allowing the service worker to inject `content.js` only into the page the user chose to inspect. The Find workflow declares separate optional permissions for Zillow, Apartments.com, Realtor.com, Redfin, Rent.com, HotPads, and Zumper; Chrome requests the relevant site access only when a user launches an assisted search that needs filters applied through that site's page controls. Chrome-internal pages cannot be inspected and surface a friendly error in the panel.

## RentSight Cloud and billing integration

Set `VITE_RENTSIGHT_API_ORIGIN` to the public Cloudflare API origin when building. This public value must match the narrow origin in `public/manifest.json`. With no value, the extension stays usable in local/free mode and the upgrade control explains that purchasing is not connected.

The extension expects this versioned API contract:

- `GET /v1/account/entitlements` returns `{ entitlements: [{ key: "plus", active: boolean, status: "active" | "trialing" | "past_due" | "canceled" | "none", source?: "pass", expiresAt?: string }] }`.
- `POST /v1/billing/checkout` creates checkout for one 30-day pass and returns `{ url: "https://checkout.stripe.com/..." }`.
- `POST /v1/billing/portal` returns `{ url: "https://billing.stripe.com/..." }`.

Authenticated calls use `Authorization: Bearer <Firebase ID token>`. Immediately before every backend request, the client calls `currentUser.getIdToken()`, which refreshes an expired Firebase ID token. RentSight never creates or stores a custom JWT. The backend must verify the Firebase ID token with the Firebase Admin SDK, use its `uid` claim as the stable account identity, and derive entitlements from its database or verified Stripe webhook state—never from client-supplied identity or plan values. A one-time pass grants the `plus` entitlement for 30 days. Checkout and portal return URLs should lead to an HTTPS page that tells users to return to the extension.

Stripe secret keys, webhook signing secrets, Firebase Admin credentials, Cloudflare credentials, database credentials, and OpenAI API keys belong only in encrypted backend secrets. The extension needs none of them. Firebase web configuration is a public project identifier and remains separate from backend credentials.

### Firebase Authentication setup (Manifest V3)

Firebase Web SDK 10.8.0 or newer is required; this project imports extension-side APIs from `firebase/auth/web-extension`. The registered `rentsight-4222d` Firebase Web app's provided public configuration is defined in `src/auth/config.ts`. Configuration fields such as `storageBucket` and `measurementId` do not initialize those products: RentSight imports and initializes only Firebase Authentication, with no Analytics, Firestore, Storage, Hosting, or other Firebase service APIs.

The canonical production bridge URL and Chrome Web Store-assigned extension ID are built-in defaults:

```text
VITE_FIREBASE_AUTH_HOST_URL=https://auth.umbrellabrand.co/rentsight/auth-host.html
VITE_RENTSIGHT_EXTENSION_ID=pkcmgccphdnmmdjhipgiohmolkailema
```

Both entries are optional for production builds because these values are canonical in `src/auth/config.ts`. The auth-host URL remains configurable for a local bridge deployment. Do not override the extension ID when using the production auth host.

The Google popup cannot run directly in an MV3 extension page. Deploy the generated `dist-auth/rentsight/auth-host.html` and every asset it references to Cloudflare at `https://auth.umbrellabrand.co/rentsight/auth-host.html`, preserving root-relative asset paths such as `/authHost.js` and `/assets/...`. This does not require or enable Firebase Hosting. The extension opens the page only inside `offscreen.html`; the hosted page uses normal `firebase/auth`, returns a Google OAuth credential through `postMessage` restricted to `chrome-extension://pkcmgccphdnmmdjhipgiohmolkailema` (or the explicit local override), and the extension signs into its own persistent Firebase Auth session with `signInWithCredential`.

Firebase Console setup:

1. Register a Firebase Web app and copy its public web configuration into the variables above.
2. In Authentication → Sign-in method, enable Google and select a support email.
3. In Authentication → Settings → Authorized domains, add `chrome-extension://pkcmgccphdnmmdjhipgiohmolkailema` as documented by Firebase and add `auth.umbrellabrand.co` for the hosted popup page.
4. Keep `public/manifest.json`'s Web Store public `key` intact. Chrome uses it to assign unpacked development builds the same `pkcmgccphdnmmdjhipgiohmolkailema` ID as the Web Store item.
5. Configure the backend Admin SDK for the same Firebase project and verify every bearer token. Key application accounts exclusively by the verified `uid`.

Cloudflare must return `Content-Security-Policy: frame-ancestors chrome-extension://pkcmgccphdnmmdjhipgiohmolkailema` on `/rentsight/auth-host.html`. Do not send `X-Frame-Options`, because it can block the required extension framing. Do not broaden this policy for unpacked development builds: the manifest `key` gives them the same allowed origin. The JavaScript bridge independently enforces that exact extension origin.

Run `npm run build` to create the Chrome extension in `dist/` and the deployment-specific auth-host bundle in `dist-auth/`. Vite builds these in separate invocations: the extension graph contains only its Manifest V3 entry points, while the hosted graph starts at `auth-host.html` and uses normal `firebase/auth`. The auth asset preparation step moves that independently generated page to `dist-auth/rentsight/auth-host.html` and verifies every referenced local asset without copying anything from `dist/`. Deploy the separate `rentsight-auth` Cloudflare Worker with `npx wrangler deploy`. Its Static Assets binding serves `dist-auth/` with `html_handling: "none"` so the required literal `/rentsight/auth-host.html` URL returns the file instead of redirecting to an extensionless path. The minimal Worker handler runs first only for that HTML URL, attaches the required `frame-ancestors` policy, and removes any `X-Frame-Options` header. No Firebase Hosting, Worker API, or extension-package files are involved in this deployment.

`public/manifest.json` includes the Web Store public `key`, required `offscreen` permission, narrow `https://auth.umbrellabrand.co/rentsight/*` auth-host permission, and extension-page `frame-src https://auth.umbrellabrand.co` entry, plus the Firebase Auth endpoints in `connect-src` (`apis.google.com`, `www.gstatic.com`, `www.googleapis.com`, `securetoken.googleapis.com`, and Identity Toolkit). The extension's own `chrome-extension://pkcmgccphdnmmdjhipgiohmolkailema` origin does not need a `host_permissions` entry. A local auth-host override also requires a development manifest whose `host_permissions` and `frame-src` allow that origin. Do not add remote scripts to `script-src`; MV3 extension JavaScript remains bundled locally.

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

All temporary assumptions live in `src/calculations/assumptions.ts`. Baseline monthly amounts are electricity $90, natural gas $45, water $35, sewer $25, trash $25, renters insurance $15, and paid shared laundry $24. Internet starts blank because it is usually a renter-level subscription; a user-entered internet amount is stored as a global preference and applied across listings unless a property explicitly includes internet at $0. Included utilities estimate to $0. Non-included utilities are adjusted by occupants (+15% after the first), bedrooms (+8% after the first), square footage (+5% per 500 square feet above 800), and housing type (apartment/condo 1.0×, townhouse 1.1×, single-family 1.2×). These defaults use deliberately low confidence and should be replaced by location-aware estimates later.

## Side-panel state and persistence

The side panel keeps one serializable analysis per listing URL in `chrome.storage.local`. Each analysis contains the normalized listing, its original extracted/default baseline, utility inclusion choices, occupancy and laundry details, and custom fees. User edits become sourced values with `source: user`; Reset restores the baseline. Untouched utility assumptions are recalculated from occupancy, bedrooms, and square footage, while user-entered amounts remain fixed. The UI materializes custom fees and paid-laundry usage into a normalized listing before invoking the pure calculation engine, so React and Chrome storage remain outside the calculation layer.

Opening the side panel automatically runs local extraction, then presents a two-stage workflow. **Review inputs** shows every relevant extracted, estimated, missing, or user-entered value with its source and allows edits. The listing summary remains visible while utilities, property expenses, move-in costs, and lease/concession fields start as collapsed, keyboard-accessible disclosure sections. RentSight does not run or display final calculations until the user selects **Confirm**. Results are tied to the confirmed analysis revision; a later edit, extraction update, or location update invalidates confirmation and requires review again. Saving the current listing is available from the confirmed results stage.

## Listing extractors

Extraction runs locally in the active tab, in priority order: JSON-LD, safely recognized embedded JSON state, a site adapter, and generic visible-text patterns. Rent ranges and conflicting prices are retained as evidence and are never silently converted to one rent. Extraction reruns after debounced SPA URL changes. Re-extraction updates the saved baseline but never replaces a field whose source is `user`.

To add another listing site:

1. Create a module in `src/extractors/` that implements `ListingExtractor` from `types.ts`.
2. Give it a stable `siteName` and `version`, a narrow `matches(url, document)` predicate, and an `extract(document, url)` implementation.
3. Use the shared parser helpers and `listingValue` so every field has listing source, confidence, and supporting text where applicable.
4. Add the adapter to `SITE_EXTRACTORS` in `src/extractors/index.ts`, ahead of the generic fallback.
5. Add anonymized HTML fixtures and tests for expected fields, missing data, ranges, and conflicting values. Do not make automated tests depend on the live site.

### Currently supported sites

- Zillow rental-detail and apartment-community pages
- Apartments.com listing pages
- Apartment List community pages with a selected unit
- Redfin rental-detail pages
- Generic rental pages through JSON-LD and visible-text fallback patterns

Site markup changes frequently. Extraction is best-effort, ambiguity is shown instead of guessed, and every value remains manually editable.

## Saved listings, comparison, and transfer

Saved analyses use versioned records in `chrome.storage.local`. Saving the same URL updates the existing record instead of creating a duplicate. Selected records can be compared, exported as RentSight JSON or CSV, and re-imported from RentSight JSON. Imports are validated and migrated before they reach storage. The comparison completeness percentage weights listing/user values above regional/default estimates and labels the result as **data completeness**, not a recommendation or quality score.

## Location estimates and external APIs

The default geocoder only parses city, state, and ZIP from entered or extracted US-style addresses. Regional utility factors come from `src/location/config.ts`; unknown states use the national 1.0 factor. Results are cached in Chrome storage, labeled as estimates, and remain editable. Mock providers cover geocoding, utility adjustments, and rent benchmarks. `MockBackendGeocodingProvider` is an optional developer adapter and is not required for the extension to function.

To add a real provider, implement the relevant interface in `src/location/types.ts`, construct it where the side panel currently selects local providers, and retain graceful fallback and cache behavior. Do not embed private API credentials in the extension bundle: browser extensions are public clients and their source can be inspected. Services requiring secret credentials must be called through a controlled backend or serverless function that authenticates requests, limits abuse, and returns only necessary data.

## Privacy considerations

RentSight performs listing extraction locally in the user-selected active tab and does not bulk scrape sites. Its listing-site host permissions are optional and limited to Zillow, Apartments.com, Realtor.com, Redfin, Rent.com, HotPads, and Zumper; when granted from the Find workflow, RentSight applies supported requested filters through the chosen site's own controls in that newly opened search. Drafts, saved listings, and location cache entries stay in `chrome.storage.local` for the current Chrome profile unless the user explicitly exports them. When RentSight Cloud is configured, the extension contacts only the declared RentSight API origin to check account entitlement and initiate user-requested billing; AI review uploads relevant listing content and preliminary values to the backend and OpenAI, excluding customer overrides and household assumptions. The extension includes no analytics, authentication bypass, or CAPTCHA workaround. Exported files may contain addresses and financial assumptions; users should store and share them accordingly.

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

## AI listing extraction (initial frontend)

Signed-in RentSight+ accounts automatically request `POST /v1/listings/extract`
after local extraction. Standard page inspection returns immediately; a separate
`GET_AI_CAPTURE` request prepares optional AI input after preliminary values are
displayed. Capture failures cannot prevent local inspection. The backend remains responsible for entitlement, atomic
usage accounting, idempotency, and the OpenAI call. No provider key is used here.
Live review requires the backend extraction service and provider configuration.
A placeholder or legacy response produces a visible failure and explicit fallback.
Frontend validation uses contract fixtures and mocked transport; it does not make
live provider calls.

`src/ai/contracts` vendors the backend-authoritative 1.1.0 schemas. `npm run contract:generate`
generates TypeScript wire types and CSP-compatible standalone validators (no
runtime schema compilation). Refresh the vendored schemas deliberately when the
backend contract changes. The capture suite checks that the schema ID, generated
type, and runtime request remain on the same version. Fixtures in
`tests/fixtures/ai` come from that contract.

Captures are bounded, preserve JSON-LD and text/table/footnote blocks, report
missing sections/truncation, and never contain customer overrides. This initial
generic capture does not expand collapsed sections, inspect cross-origin frames,
or infer unstated lease selections. Explicit month selections from labeled lease
selectors are captured; missing lease-selection context is sent as null.

The side panel shows an animated AI progress card after preliminary extraction.
Edits remain enabled; Confirm waits for success or explicit continuation after
failure. Network retries reuse the frozen body/key. Typed terminal retries follow
`retryMode`; late responses are discarded on navigation, recapture, or account
changes. Closing the panel drops pending captures; reopening intentionally starts
a fresh capture/request. Successful abandoned backend work may still count once.

The calculator adapter replaces the preliminary baseline completely, then applies
current user-sourced values and explicit deletions. Supported exact USD amounts
are mapped; qualified charges and promotions require an explicit manual decision.
The original AI response retains all ranges, conditions, source scope, evidence,
notes, identity, and metadata alongside saved analyses. Source notes are labeled
as baseline context so they do not claim to support customer overrides.

### Capture regression and evaluation-fixture workflow

The frontend tests browser DOM interpretation and request construction; the
backend evaluation corpus tests model interpretation, Structured Outputs, and
semantic validation. Frontend tests never call the real backend or a paid model.

- `npm run test:capture` runs deterministic stored/synthetic HTML capture tests.
- `npm run test:e2e` runs the extension flow with mocked transport.
- `npm run test:live-sites` is an explicit, optional public-site smoke-test lane
  and is never required for ordinary pull requests.

Capture fixtures live in `tests/capture/fixtures`. Development builds show an
**Export extraction capture** action in the Current view after capture is ready.
It downloads the exact normalized v1.1.0 request body with a fresh request UUID;
it does not upload anything. Production builds do not include the action. The
request shape contains only identity, capture metadata and blocks, and preliminary
listing values—not authorization headers, Firebase tokens, cookies, extension
storage, Stripe data, customer edits, or household assumptions.

Before placing an export at `backend/evals/cases/<case-name>/capture.json`, copy it
to a working file and remove or replace personal details that are unrelated to the
failure (names, contact details, exact addresses, tracking query parameters, and
unrelated page copy). Preserve evidence-relevant text exactly—including labels,
amounts, cadence, qualifications, section paths, selected-unit context, and block
boundaries—or the fixture no longer reproduces the defect. Review the complete
JSON manually before committing it.

For a problematic listing: reproduce it in the extension, export the normalized
request, and decide whether browser capture or backend interpretation is wrong.
Reduce the defect to a reusable structural class. If capture is wrong, add a
sanitized HTML fixture and fix the general capture rule. If interpretation is
wrong, add the sanitized request to the backend evaluation corpus. Run both
relevant suites. Do not add listing-specific selectors, hostname exceptions, or
text rewrites merely to make one property pass.
