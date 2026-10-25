# Fee format corpus and readiness gate

Run `npm run test:fees` for the complete fee regression suite, including Realtor,
AI contracts, capture, content-script refresh, review, calculations, and saved
transfer/comparison. Run `npm run test:fees:strict` when assessing readiness for
all documented cases. Both commands now pass: all 27 previously tracked failures
were fixed and promoted to ordinary regression tests.

All HTML in this directory is **synthetic**. The Realtor recordings in
`../../realtor/` are separate real-page evidence. These fixtures contain no
personal data, remote assets, network requests, or paid model calls. Results are
not a production-site accuracy score and do not evaluate backend model quality.

## Layout coverage

Each layout describes the same obligations: $27 monthly connectivity, $5.95
monthly utility billing, and optional $40 monthly storage. The expected bill is
$32.95 in additional required monthly fees; storage does not automatically add
$40. Expectations are authored independently of the extraction output.

| Fixture                   | Current local behavior | What the test requires                                                                             |
| ------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------- |
| `prose.html`              | Supported              | Pair label-first amounts in separate paragraphs.                                                   |
| `amount-first.html`       | Supported              | Keep amount-first clauses separate at semicolons.                                                  |
| `bullets.html`            | Supported              | Read nested labels and prices in list items.                                                       |
| `zillow-calculator.html`  | Supported              | Inherit required/optional monthly groups; preserve optional price despite a selection total of $0. |
| `realtor-card.html`       | Supported              | Pair sibling columns and ignore estimated totals.                                                  |
| `realtor-inline.html`     | Supported              | Split comma-delimited fee details.                                                                 |
| `currency-spaces.html`    | Supported              | Keep nonbreaking currency spaces and nested inline labels readable.                                |
| `table.html`              | Supported              | Amounts pair correctly, but column headings must not become a property-note suggestion.            |
| `whitespace.html`         | Supported              | A soft line wrap must not lose “required monthly” context.                                         |
| `description-list.html`   | Supported              | Pair `dt` labels with their `dd` amounts and inherit section context.                              |
| `aria-table.html`         | Supported              | Read div-based ARIA table rows.                                                                    |
| `mobile-cards.html`       | Supported              | Pair card headings/prices and inherit section aria-labels.                                         |
| `sibling-paragraphs.html` | Supported              | Pair labels and amounts across sibling paragraphs.                                                 |
| `inline-generic.html`     | Supported              | Split generic comma-delimited fee details.                                                         |
| `usd-prefix.html`         | Supported              | Recognize explicitly stated USD amounts without a dollar sign.                                     |

Every format also has an ordinary passing capture test: all fee labels and
amounts must survive into a schema-valid extraction request. Preserving evidence
for AI is distinct from successfully extracting it locally.

For supported layouts, tests verify editable named inputs, one priced optional
note, no duplicate aggregate, monthly and first-year cost impact, zero extra
move-in cash for monthly fees, duplicate evidence, user corrections, Keep and
Dismiss decisions, persistence, and comparison.

## Charge semantics

Passing conservative tests keep unspecified, ranged, percentage-based, weekly,
annual, optional, conditional, per-person, and per-occurrence charges out of
fixed monthly inputs. A missing amount cannot borrow the next charge's value.

Ordinary regression assertions also verify:

- “up to” and “starting at” amounts must remain qualified rather than exact;
- dollar signs with a foreign currency must not silently become USD;
- conflicting monthly/yearly cadence must remain a note rather than an exact rate;
- notes must retain both range endpoints and weekly cadence;
- explicitly free required services should retain a known zero;
- totals that already include fees must not charge those fees twice;
- first/last month rent must populate upfront rent inputs.

The AI contract suite validates synthetic responses against exact capture
quotes before applying them. It covers monthly fees with unstated refundability,
nonrefundable expenses versus refundable deposits, ranges, foreign currency,
weekly/yearly cadence, applicability, selected-unit scope, per-person/vehicle
basis, priced note decisions, and pet charges for zero, one, and multiple pets.
It also rejects forged cross-block evidence.

AI workflow regressions verify:

- structured `per_pet` basis survives when evidence uses “for each animal”;
- refundable holding deposits reach move-in cash without duplicating credited payments;
- prepaid first-month rent affects cash without increasing annual expenses.

The seven older `feeExtraction.test.tsx` defects also have ordinary passing
assertions for generic/Apartments.com cadence, hidden or recommended property
exclusion, and custom refundable utility deposit classification.

`feeFixWorkflow.test.tsx` adds actual save/transfer/comparison checks, deposit
credits against full versus remaining balances, explicit base versus inclusive
pricing, calculator caps, foreign currency context, and atomic source capture.

## Adding and promoting a format

1. Add sanitized HTML and a case to `cases.ts`. Prefer a recorded real-page
   fragment when available, and document its source/date separately.
2. Use the common amounts and obligations above, or add a separate test with
   explicitly authored expected outcomes for a materially different scenario.
3. A supported case has no `gap`. An unsupported case has a concrete `gap`
   description; use `gapAssertion: 'notes'` only when amount extraction already
   works and the known failure is note pollution.
4. Standard runs execute known gaps with Vitest expected-failure semantics:
   they must fail, and an unexpected pass fails the run. They are not skipped
   and must not be counted as passing accuracy coverage.
5. After implementing support, remove the manifest gap. The fixture then gains
   the full supported workflow checks. For standalone semantic cases, replace
   `feeGap` with `it` and move it into the appropriate supported section.
6. Run the standard suite and strict gate. The strict gate turns **all** fee-gap
   assertions, including future manifest gaps, into ordinary assertions. No current fixture
   is marked as a gap.

The environment toggle lives in `tests/helpers/feeGap.ts`. Do not auto-classify
cases from observed results or change expectations merely to make tests green.
