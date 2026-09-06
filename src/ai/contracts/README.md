# Listing extraction contract 1.0.0

**Status: proposed implementation target.** This repository does not yet contain
an extraction implementation or the frontend's calculator schema. The field set
below is the proposed shared extraction representation; the calculator adapter
must map it explicitly. Publishing these files does not change the live endpoint.

## Files

- `request.schema.json`: complete JSON Schema for the HTTP request.
- `response.schema.json`: disjoint successful and failed HTTP responses.
- `model-output.schema.json`: AI-produced `result` only. Backend identity,
  timestamps, hashes, model and prompt versions never come from model output.
- `examples/`: complete request/response fixtures, including HTTP status mapping.
- `verify.py`: schema and fixture verification (Python 3 plus `jsonschema`).

JSON schemas use draft 2020-12 and are the canonical wire contract. Required-key
shape validation is necessary but does not replace the semantic rules below.
`1.0.0` is exact: reject other versions until explicitly supported. Adding required
fields or enum values requires a new negotiated contract version; never silently
change the meaning of v1. Prompt changes can retain the schema version.

## Transport and identity

`POST /v1/listings/extract`

```http
Authorization: Bearer <Firebase ID token>
Content-Type: application/json
Idempotency-Key: <identity.requestId>
```

All top-level request keys are required:

```text
schemaVersion: "1.0.0"
identity:
  requestId: UUID generated for this intentional extraction
  captureRevision: opaque revision of this frozen capture/selection
  listingUrl: absolute http(s) listing URL
  selectedUnit: { id: string | null, label: string } | null
  selectedLeaseTermMonths: positive number | null
capture:
  capturedAt: UTC RFC3339 timestamp
  truncated: boolean
  unavailableSections: string[]
  blocks: { id, kind, sectionPath: string[], text }[]
preliminaryValues: { fieldPath: JSON Pointer, value: any JSON value }[]
```

A block kind is `heading`, `paragraph`, `table`, `json_ld`, `footnote`, or `other`.
Block IDs must be unique and stable within the capture. A table is serialized as
text with explicit column headings, row labels, and cell boundaries (for example,
a Markdown table). `sectionPath` gives the heading ancestry. Serialize JSON-LD as
valid JSON text, without executable scripts. Evidence quotes reference this exact
text, so preserve the sent block strings unchanged while validating the response.
Selected values may be captured as selection context; omit arbitrary user form
inputs, authentication data, and unrelated page content.

`preliminaryValues` contains local hypotheses only, never customer overrides.
Paths use the response result root (for example `/property/baseRent`). Values use
the underlying field value shape when available; scalar legacy guesses are also
permitted because these values are hints, not a second accepted extraction.
Reject duplicate paths, paths outside the known extraction fields, and oversized
hints. An empty array is valid. Neither hypotheses nor selection context alone
count as listing evidence.

Initial backend limits: 512 KiB UTF-8 request body, 200 blocks, 200,000 Unicode
code points of combined block text, 100 preliminary values, 16 KiB canonical JSON
per preliminary value, and 200 characters per identifier. Reject excess with
`INVALID_REQUEST` / HTTP 413; do not silently truncate. Capture timestamps are
client observations, not trusted server timestamps. Empty or irrelevant content
passes structural validation but fails with `UNUSABLE_CAPTURE`.

Echo the validated identity unchanged in both success and failure. Use null only
when a trustworthy validated identity is unavailable (such as an auth or malformed
request failure). Do not echo arbitrary malformed input in an error.

The frontend accepts a response only when its identity matches the active request,
including request ID, capture revision, URL, selected unit, and selected lease
term. A new intentional extraction supersedes the old request even on the same
page. Checking only the URL is insufficient.

## Successful response

```text
schemaVersion: "1.0.0"
status: "succeeded"
identity: same validated identity as request
metadata:
  extractionId: backend-generated immutable identifier
  capturedAt: capture.capturedAt
  completedAt: backend UTC RFC3339 timestamp
  promptVersion: deployed prompt identifier
  model: actual provider-returned model identifier
  captureSha256: lowercase SHA-256 of canonical capture JSON
result:
  property: complete property object
  evidence: { id, blockId, quote }[]
  notes: { id, fieldPaths, text, evidenceIds }[]
  reviewIssues: { id, code, fieldPaths, message, evidenceIds }[]
```

Canonical JSON for hashing recursively sorts object keys lexicographically,
retains array order, emits UTF-8 with literal Unicode and no insignificant
whitespace, and uses JSON literals. The capture schema contains no numbers, so
numeric serialization differences do not affect `captureSha256`. The server
computes this hash; the client need not reproduce it to apply a response.

### Required property fields

| Field                                  | Underlying value                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------- |
| `propertyName`, `address`, `unitLabel` | String; address preserves the stated address rather than inventing components               |
| `bedrooms`, `bathrooms`                | Nonnegative number; zero bedrooms means explicitly supported studio; half bathrooms allowed |
| `floorArea`                            | Exact/range quantity in `sq_ft` or `sq_m`                                                   |
| `baseRent`                             | Money representing contractual base rent, excluding concessions                             |
| `fees`                                 | Array of fee records; includes deposits, excludes utility records                           |
| `utilities`                            | Array of utility records; no duplicate charge in `fees`                                     |
| `leaseTerm`                            | Exact/range duration in `months`, `weeks`, or `days`                                        |
| `availableOn`                          | ISO `YYYY-MM-DD` date; ambiguous dates remain unknown/conflicting                           |
| `promotions`                           | Array of conditional promotion records                                                      |

Each field has the same envelope, including fields inside fees/utilities/promotions:

```json
{
  "status": "unknown",
  "value": null,
  "candidates": [],
  "scope": "unknown",
  "evidenceIds": []
}
```

| Status           | Meaning and invariant                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `known`          | Non-null supported value; empty candidates; at least one valid evidence ID                    |
| `unknown`        | Null value, empty candidates; no supported value available                                    |
| `not_applicable` | Null value, empty candidates; evidence supports inapplicability                               |
| `conflict`       | Null value and at least two distinct supported candidates; evidence captures the disagreement |

Scope is `selected_unit`, `floor_plan`, `building`, `listing`, or `unknown`.
A known range is a known value, not a conflict. A conflict is incompatible claims,
not an invitation to average them. Every candidate uses the same value shape as
that field. Scope describes the source claim; do not relabel building-wide rent
as selected-unit rent. Emit `UNIT_SCOPE_UNCERTAIN` where relevant.

`fees.value: []` with `known` requires evidence that there are no applicable fees;
missing fee content is `unknown` with null. A nonempty known collection means
those entries are supported; it does not assert the listing discloses every
possible charge. Represent incomplete coverage in `reviewIssues`. A known utility
record can have an unknown amount. Unknown is never zero, false, or an empty list.

Money uses integer currency minor units, an uppercase ISO 4217 currency code,
`kind: exact | range`, nullable `minMinor` / `maxMinor`, a frequency, and a basis.
An exact value has equal non-null bounds. A range has at least one bound; if both
exist, min is strictly less than max. An open-ended "from $2,400" is a range
with `minMinor: 240000, maxMinor: null`. Values must be nonnegative safe integers.
Currency must be established from the source; if it cannot be established, leave
the money field unknown. Never infer USD merely from the `$` symbol alone.

Frequency is `monthly`, `weekly`, `daily`, `yearly`, `one_time`, `per_occurrence`,
or `unknown`. Basis is `per_unit`, `per_person`, `per_pet`, `per_vehicle`,
`per_application`, or `unknown`. Unknown frequency/basis is allowed as an
extracted qualification but cannot be silently normalized by the calculator.
Quantity bounds follow the same exact/range rules, with nonnegative numbers.
Lease/free-rent durations and selected lease durations must be positive.

Fee records contain a stable result-local ID, label, category, money field,
applicability, and a refundable boolean field. Applicability has a structural
`kind` (`required`, `optional`, `conditional`, `unknown`), conditions, and evidence.
Conditional applicability requires at least one condition. A deposit remains a
deposit even when its refundability is unknown. Utility records separately capture
responsibility (`included_in_rent`, `tenant_pays_provider`,
`tenant_pays_landlord`) as a field, amount, and applicability. Included utilities
use an inapplicable additional amount rather than an invented $0 bill.

Promotions separately capture benefit type, discount, free-rent duration,
advertised effective rent, required lease term, application/move-in deadlines,
and applicability. Unsupported parts remain unknown; inapplicable benefit fields
can be marked not applicable. Preserve other conditions in the conditions array.
Do not calculate an effective rent inside extraction. Extract it only if advertised;
the existing calculator independently computes qualified concessions and totals.

### Evidence, notes, and semantic acceptance

IDs are unique in their respective collections. All evidence IDs must resolve,
including IDs nested inside fields and candidates. Every quote must be nonempty
and an exact contiguous substring of the referenced block's `text`, preserving
case, punctuation, and whitespace. No matching against the preliminary values.
All note/issue paths are RFC 6901 JSON Pointers rooted at `result`, must resolve,
and must identify property content. Array indices refer to this immutable result.

Substring validation proves the quote exists, not that it supports the value.
Validate types, bounds, dates, units, duplication, selected-unit scope, and obvious
business contradictions as well. Reject unsupported evidence or inconsistent
field envelopes; never repair malformed output by filling it with empty fields.
Treat capture content as untrusted data, never as model instructions.

Notes are short customer-facing qualifications. Review issue codes are
`UNKNOWN_VALUE`, `CONFLICTING_VALUES`, `RENT_RANGE`, `CONDITIONAL_CHARGE`,
`PROMOTION_CONDITIONS`, `UNIT_SCOPE_UNCERTAIN`, and `SOURCE_INCOMPLETE`.
The backend must ensure incomplete capture coverage is surfaced as
`SOURCE_INCOMPLETE` when `truncated` is true or sections are unavailable, even if
the model omits that issue. A partly captured but useful listing can succeed;
a capture that cannot support a relevant extraction fails.

**The AI does not decide whether Confirm is enabled.** The existing calculator's
input requirements determine which unresolved fields block confirmation. For a
single monthly total, a rent range/conflict must be resolved. A conditional charge
requires applicability resolution when that charge affects the requested result.
An unknown utility estimate need not block a calculation that explicitly supports
customer-provided estimates. Do not gate solely on whether issues are present.

## Replacement and review semantics

Replace the entire preliminary baseline only after success and identity checks.
Never merge missing/null AI fields with preliminary values. Customer overrides,
including deletions, live separately and are applied afterward using their latest
state. Use explicit override presence; a deliberate null/delete is still an edit.
Overrides are not part of this extraction request or its idempotency payload.

AI evidence stays attached to the immutable extracted value. An overridden value
must not inherit AI attribution; notes that describe the old value must be shown
as baseline context or hidden rather than describing the override as AI-extracted.

While a request runs, edits are allowed and Confirm is disabled. After success,
show review issues and apply calculator-specific validation. After failure, retain
the preliminary baseline and require an explicit choice to continue or retry.
Starting extraction after confirmation returns the analysis to review first.
Persist saved values with their baseline, overrides, evidence, notes, issues,
identity, metadata, and schema version. Do not persist full captures by default.

## Failure response and retry behavior

Failures have `schemaVersion`, `status: failed`, nullable `identity`, and `error`.
They never contain `result` or a replacement baseline. `error` contains a stable
`code`, safe customer-facing `message`, `retryable`, `retryMode`, and nullable
nonnegative `retryAfterSeconds`. Do not return provider debug output or secrets.

| Code                     | HTTP                      | Retry mode                                       |
| ------------------------ | ------------------------- | ------------------------------------------------ |
| `INVALID_REQUEST`        | 400 (413 for size limits) | none; fix request                                |
| `UNAUTHENTICATED`        | 401                       | none; restore authentication before resubmission |
| `ENTITLEMENT_REQUIRED`   | 403                       | none; entitlement required                       |
| `USAGE_LIMIT_EXCEEDED`   | 429                       | none until quota/entitlement changes             |
| `RATE_LIMITED`           | 429                       | same_request, with delay                         |
| `IDEMPOTENCY_CONFLICT`   | 409                       | none; key bound to a different payload           |
| `EXTRACTION_IN_PROGRESS` | 409                       | same_request, with delay                         |
| `UNUSABLE_CAPTURE`       | 422                       | none; recapture before a new request             |
| `MODEL_REFUSAL`          | 422                       | none                                             |
| `MODEL_OUTPUT_TRUNCATED` | 502                       | new_request                                      |
| `MODEL_OUTPUT_INVALID`   | 502                       | new_request                                      |
| `MODEL_EVIDENCE_INVALID` | 502                       | new_request                                      |
| `UPSTREAM_TIMEOUT`       | 504                       | new_request after terminal failure               |
| `UPSTREAM_UNAVAILABLE`   | 503                       | new_request                                      |
| `INTERNAL_ERROR`         | 500                       | same_request when outcome is unknown             |

`retryable` is exactly `retryMode != none`. A `new_request` retry is an explicit
customer retry of a terminal failed extraction, with a new ID/key and review
state. A network error with no terminal response always retries the same frozen
body/key: the backend may already have completed the extraction. Refreshing an
expired Firebase token does not itself require changing the extraction key.
A failure to repair inputs is not an automatically retryable extraction.

Reserve an account-scoped idempotency key and its payload fingerprint atomically
before a provider call. Bind the fingerprint to the entire validated body,
including schemaVersion, identity, capture, and preliminary values, using a
consistent backend JSON canonicalization. Exclude auth headers. Identical requests
join/replay existing work; mismatched payloads return `IDEMPOTENCY_CONFLICT`.
Do not launch a second provider call merely because a client disconnects or a
worker lease expires with an uncertain provider outcome.

Retain terminal idempotency records for at least 24 hours. Retries outside that
window are new work and must use a new key. Nonterminal in-progress/rate-limit
responses do not replace the eventual terminal result. Retain terminal failures
as well as successes, so same-key retries cannot rerun failed provider work.
Atomically reserve usage with work admission, commit one extraction credit on
accepted success, and release it on terminal failure. Maintain separate request,
concurrency, and provider-spend limits so repeated failed attempts remain bounded.
An abandoned but successfully completed request counts once. Never count replay
as another extraction.

All errors from this route, including authentication and body parsing, must use
this envelope once implemented. **Current auth middleware still returns the older
`{message}` shape; the extraction implementation must adapt it for this route.**
Other existing routes retain their documented error contracts.

## Model boundary

The backend uses only `model-output.schema.json`'s root shape and `$defs` as its
strict Structured Outputs schema, retaining the HTTP envelope under server
control. Metadata such as `$id`/`$schema` can be stripped before submission.
Refusal, incomplete provider output, absent parsed content, schema failure, and
semantic failure are handled before constructing any successful HTTP response.
Model selection remains backend configuration; fixture model IDs are intentionally
non-production placeholders. This deliverable makes no live provider calls.

## Examples and verification

Examples cover a normal listing (including an unknown electricity bill), unknown
fees, a rent range, a conditional promotion, and seven typed failures. Each
`.request.json` has a matching `.response.json`; `http-statuses.json` specifies
HTTP status. Failure fixtures describe outcomes, not deterministic prompts that
force a provider failure. The idempotency-conflict example presumes a prior
request used that same key with a different body.

Run `python3 contracts/extraction/v1/verify.py`. This validates schemas, examples,
field envelopes, ranges, evidence references and quotes, identity, timestamps,
hashes, and pointer targets. It also verifies representative corruptions are
rejected. It does not implement the endpoint or assess model extraction accuracy.
Before rollout, test the calculator adapter against the frontend's actual input
requirements and evaluate extraction on representative real listing captures.
