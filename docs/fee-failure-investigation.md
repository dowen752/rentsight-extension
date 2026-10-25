# Investigation of the 27 strict fee failures

## Resolution

All 27 original assertions now pass as ordinary regression tests. The original
expectations were retained; their expected-failure wrappers were removed. All
15 format fixtures now receive the full review, calculation, correction,
note-decision, transfer, and comparison checks.

The fixes share bounded listing evidence, semantic label/amount pairing, and
cadence-aware classification. Qualified amounts and foreign currencies remain
priced notes; included totals are charged once. Prepaid rent uses existing
first/last-month inputs, refundable deposits stay cash rather than expenses,
and trusted pet billing basis survives saving and household changes.

Additional workflow regressions cover credited holding payments against both a
full deposit and a remaining balance, calculator precedence, explicit base rent
versus inclusive pricing, and price qualifiers in calculator labels. The old
calculator expectations that treated “Not to Exceed” as an exact amount were
corrected: capped charges now remain reviewable notes, including on Realtor.

Rechecking the original October 13 full-page captures also caught and fixed a
shared-reader interaction with Realtor's bare numeric deposit facts. The reader
now prefers the active listing panel and accepts bounded numeric monetary facts.
Slick Rock extracts rent/deposit $3,995, three bathrooms, and separate $37/$10
monthly services. Pearl preserves the $1,858–$3,960 base-rent range, separate
$15/$5.95/$21 monthly services, and the $500 combined deposit. This replay uses
recorded DOM, not a new live-site or backend-model evaluation.

Final validation: `npm run test:fees:strict` passes 422 tests, `npm test` passes
636 tests across 43 files, and lint and the production build/asset verification
pass. The extension ZIP was rebuilt from the verified build. Backend prompt
requirements are documented separately; no backend service was deployed here.

The inventory and budget probes below record the behavior **before these fixes**.
They are retained to explain the defects rather than describe current behavior.

The attached strict-run output was reproduced against the current checkout:
**354 passing tests and 27 failing tests across three test files**. These are the
same seven older and twenty newly documented gap assertions. They are not new
regressions introduced by running strict mode. Strict mode changes `feeGap` from
Vitest expected-failure behavior into an ordinary assertion; production code is
unchanged by the toggle.

All 27 are product behavior assertion failures, rather than fixture-validation
errors, crashes, or transport failures. These fixtures are synthetic except for
the separate passing Realtor recordings. Their failure count is not a live-site
failure rate or a measurement of the backend model's extraction accuracy.

## What matters most

The failures cover nine outcome groups, with several sharing code paths:

| Outcome group                         | Failures | Product impact                                                                                                       | Recommended priority     |
| ------------------------------------- | -------: | -------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Unsafe amounts or duplicated expenses |        6 | Fixed monthly inputs can include capped/foreign/annual amounts; included fees and prepaid rent can be counted twice. | First                    |
| Monthly/one-time classification       |        4 | Monthly bills, move-in cash, and first-year cost disagree with the listing.                                          | First                    |
| Fees from another source/property     |        2 | A hidden or recommended property's $999 fee replaces the current property's $65 fee.                                 | First                    |
| Refundable deposit classification     |        2 | Cash needed to move in is omitted, or deposits become expenses.                                                      | First                    |
| Missing prepaid rent inputs           |        1 | First and last month rent required at signing are omitted.                                                           | First                    |
| Lost pet billing basis                |        1 | Two pets can be charged as one.                                                                                      | Next                     |
| Missing format/normalization support  |        7 | Required $27 and $5.95 charges are omitted or only partially recovered.                                              | Next                     |
| Incomplete/noisy notes                |        3 | Headers become notes; ranges and payment cadence lose useful information.                                            | With shared parser work  |
| Free service represented as unknown   |        1 | An explicitly known zero is lost.                                                                                    | With money normalization |
| **Total**                             |   **27** |                                                                                                                      |                          |

## Complete failure inventory

Numbers below enumerate individual tests, including parameterized cases that
Vitest combines under one assertion diff. Each row maps to one of the 27.

| #   | Failing case                               | Observed behavior                                                                            | Root cause / code owner                                                                                                                                                                                            |
| --- | ------------------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | AI prepaid first-month rent                | First-year cost is $29,540 instead of $27,540. Move-in cash already includes $2,000.         | `move_in` always maps to `otherMoveInFees`; the annual calculator correctly treats that field as a nonrefundable expense. Prepaid rent must use `firstMonthsRent`.                                                 |
| 2   | AI structured `per_pet` basis              | Two pets cost $35 instead of $70.                                                            | The adapter reads `Money.basis` for eligibility but discards it from the normalized input. `materializeListing` later multiplies only when the evidence note literally contains “per pet.”                         |
| 3   | AI refundable holding deposit              | Refundable deposits are $0 instead of $350.                                                  | `holding_deposit` exists in the wire contract but has no entry in the adapter's upfront mapping. It is deferred to a note.                                                                                         |
| 4   | Generic one-time amenity fee               | $100 lands in monthly `amenityFees`.                                                         | Generic extraction assigns a destination from the label, without reading frequency.                                                                                                                                |
| 5   | Apartments.com one-time amenity fee        | Same $100 monthly misclassification.                                                         | Apartments.com duplicates the same fixed label-to-destination mapping.                                                                                                                                             |
| 6   | Generic monthly administrative fee         | $10 lands in upfront `administrativeFee`.                                                    | The matched supporting text begins at “administrative fee,” dropping the preceding “Monthly.” The destination is hardcoded upfront.                                                                                |
| 7   | Apartments.com monthly administrative fee  | Same $10 upfront misclassification.                                                          | Its fee-pattern table hardcodes the upfront destination and drops preceding timing context.                                                                                                                        |
| 8   | Generic hidden application fee             | $999 wins over the visible $65.                                                              | Standard fee extraction searches `document.body.textContent`, which includes hidden content, then accepts the first match.                                                                                         |
| 9   | Generic recommended-property fee           | Another property's $999 wins over the current $65.                                           | The same whole-body first-match logic crosses listing boundaries, including `<aside>`.                                                                                                                             |
| 10  | Zillow refundable custom utility deposit   | `utilityDeposits` is missing; $100 instead becomes `otherMoveInFees`.                        | Custom move-in rows are aggregated as fees without preserving refundability or deposit purpose.                                                                                                                    |
| 11  | Native table header note                   | “Charge Cost Frequency Applies” appears as an extra note. Actual fee amounts pair correctly. | The shared scanner treats `<thead><tr>` as a fee row; the word “Charge” passes the fee filter, and missing money creates a note.                                                                                   |
| 12  | Soft line wrap                             | $27 connectivity survives; the $5.95 utility billing fee disappears from named inputs.       | The shared parser splits a paragraph at `\n` before normalizing layout whitespace. “Required” is detached from “monthly … $5.95.”                                                                                  |
| 13  | Description list (`dt`/`dd`)               | No named required fees.                                                                      | The scanner does not pair description-list labels and values or inherit their section heading.                                                                                                                     |
| 14  | ARIA div table                             | No named required fees.                                                                      | `role="row"` / `role="cell"` divs are not recognized as semantic rows.                                                                                                                                             |
| 15  | Mobile cards                               | No named required fees.                                                                      | The scanner lacks bounded article heading/value pairing and section `aria-label` inheritance.                                                                                                                      |
| 16  | Sibling label/value paragraphs             | No named required fees.                                                                      | Each paragraph is read alone; a label creates an amount-missing suggestion and the separate price is ignored.                                                                                                      |
| 17  | Generic inline comma list                  | No separated named required fees.                                                            | Three comma-connected fee concepts remain one clause. Multiple dollar amounts prevent automatic application and produce a combined suggestion. Realtor has a separate splitter that the generic path does not use. |
| 18  | `USD 27.00` without `$`                    | No named required fees.                                                                      | Local money scanning requires the dollar symbol; explicit currency codes are not parsed.                                                                                                                           |
| 19  | Local first/last month rent due at signing | Both upfront rent inputs are undefined instead of $2,000 each.                               | Generic extraction has no patterns for these existing calculation fields. The additional-fee scanner also filters for fee-like labels, not prepaid rent.                                                           |
| 20  | “up to $27”                                | Applied as an exact $27 monthly fee.                                                         | Automatic application checks for one dollar amount, not whether it is a maximum.                                                                                                                                   |
| 21  | “starting at $27”                          | Applied as an exact $27 monthly fee.                                                         | The same guard does not distinguish a lower bound from an exact cost.                                                                                                                                              |
| 22  | `$27 CAD`                                  | Applied as $27 in the USD calculation.                                                       | Local parsing discards currency context. The validated AI adapter already rejects foreign-currency automatic inputs.                                                                                               |
| 23  | “monthly … $27/year”                       | Applied as $27 per month.                                                                    | “Monthly” sets cadence, but the exclusion checks `annual`/`yearly`, not `/year`; contradictory cadence is not resolved.                                                                                            |
| 24  | `$10 - $30` note                           | The note says only `$10/month`.                                                              | Automatic application correctly rejects multiple amounts, but note rendering takes only the first match.                                                                                                           |
| 25  | `$27 per week` note                        | The amount survives; the note says timing needs confirmation.                                | The shared layer stores only a `monthly` boolean, so stated nonmonthly cadence is lost.                                                                                                                            |
| 26  | “free” required service                    | Unknown instead of a sourced zero.                                                           | Money parsing understands numeric `$0`, not explicit zero-cost words.                                                                                                                                              |
| 27  | Advertised total includes the fee          | $2,027 rent plus $27 fee becomes $2,054.                                                     | Rent extraction and fee extraction run independently; no reconciliation records that the fee is already included in the price.                                                                                     |

## Source findings

### Scope and row association

[Generic extraction](../src/extractors/generic.ts:25) searches body text for
standard charges. The shared [fee scanner](../src/extractors/fees.ts:199) reads
`.fee-row`, `tr`, `p`, and `li`, with special scoping only for Realtor. Therefore
fixing the additional-fee scanner alone does not remove an unsafe standard fee
already written by a site/generic extractor.

The shared scanner [splits raw text before whitespace normalization](../src/extractors/fees.ts:224),
[infers context from preceding ancestor children](../src/extractors/fees.ts:238),
and [accepts one dollar match](../src/extractors/fees.ts:311). This explains both
missed structures and false confidence in qualified amounts. Simply adding every
div to the selector would introduce parent wrappers, grouped fees, and unrelated
prices; the correct unit of parsing is a bounded label/value row or clause.

Realtor already has useful scoped row/inline handling in
[realtorDom.ts](../src/extractors/realtorDom.ts). That behavior should inform a
shared reader without broadening source scope or forcing every site into
Realtor-specific selectors.

### Classification and calculation inputs

[Generic](../src/extractors/generic.ts:140) and
[Apartments.com](../src/extractors/apartments.ts:148) standard fee mappings ignore
frequency. [Zillow custom upfront fees](../src/extractors/zillow.ts:584) drop
refundability when aggregating into `otherMoveInFees`.

The [AI adapter's upfront map](../src/ai/adapter.ts:219) omits holding deposits
and sends `move_in` to nonrefundable expenses. Its
[money gate](../src/ai/adapter.ts:142) is otherwise appropriately conservative
about currency, exactness, frequency, basis, and selected-unit scope. These AI
failures are consumer/normalization problems with a valid synthetic response,
not evidence that the backend model failed to identify the amounts.

The [pet multiplier](../src/shared/analysis.ts:219) depends on evidence-note
wording. Billing basis should survive normalization and persistence as data,
with compatibility for older records, rather than depend on whether a quote
contains one exact phrase.

The [annual calculator](../src/calculations/calculator.ts:143) follows its current
model correctly: twelve months of recurring costs plus nonrefundable move-in
expenses. The dominant errors arise from values reaching the wrong inputs.
Those incorrect values then propagate to saved listings and comparison using
the same materialized listing. Fixing only a displayed result would leave the
workflow inconsistent.

## Verified budget impact

In additional synthetic probes, advertised rent was explicitly set to $2,000
and the same household/utility assumptions were used for the control and fee
listing. This isolates fee impact from missing site-specific rent selectors.

| Listing statement                                           | Current added monthly cost | Current move-in cash | Current added first-year cost | Intended interpretation                                            |
| ----------------------------------------------------------- | -------------------------: | -------------------: | ----------------------------: | ------------------------------------------------------------------ |
| One-time amenity fee $100 (generic and Apartments.com)      |                       $100 |                   $0 |                        $1,200 | $100 one-time expense: $100 cash and $100 added annual cost.       |
| Monthly administrative fee $10 (generic and Apartments.com) |                         $0 |                  $10 |                           $10 | $10 monthly: $120 added annual cost.                               |
| Visible application fee $65 with hidden $999 fee            |                         $0 |                 $999 |                          $999 | Use the current visible $65 charge.                                |
| Required monthly fee “up to $27”                            |                        $27 |                   $0 |                          $324 | Preserve the cap as a priced note; do not claim a definite amount. |
| Required monthly fee `$27 CAD`                              |                        $27 |                   $0 |                          $324 | Preserve currency in a note; do not interpret CAD as USD.          |
| Conflicting “monthly … $27/year”                            |                        $27 |                   $0 |                          $324 | Review cadence; do not silently apply a monthly rate.              |
| Refundable utility deposit $100                             |                         $0 |                 $100 |                          $100 | $100 refundable cash, excluded from annual expense.                |

The fixture also directly verifies a $2,000 prepaid-rent annual overstatement,
a $35 monthly shortfall for two pets, and a missing $350 holding deposit.

## Test audit and boundaries

The observed failures are valid behavior gaps, but follow-up regression tests
should make several expectations more robust:

- **Range typography:** assert that both endpoints and range meaning survive,
  allowing faithful `$10 - $30` as well as `$10–$30`. The current output actually
  loses the upper endpoint, so the present failure is substantive.
- **Per-pet evidence:** the current fixture provides trusted `basis: per_pet`
  with a quote that does not state the basis. Keep the adapter contract test,
  and add realistic evidence such as “for each animal” or a separate basis
  column. Also test `per_unit`, user overrides, re-extraction, and saved transfer
  so multiplying all pet amounts does not create a new bug.
- **Holding deposits:** the current test represents a standalone refundable
  $350 payment. Add credited-to-security and remaining-balance cases before
  mapping it to “Other deposits.” Summing a credited holding payment and a full
  security deposit would overstate cash. The existing Realtor remaining-balance
  regression already exercises a related correctly handled case.
- **Included pricing:** test both separate base rent plus fees and genuinely
  inclusive totals, including partial fee breakdowns. Do not subtract an
  incomplete or optional breakdown from a headline total.
- **Monthly admin applicability:** add required, optional, and conditional cases.
  Correct cadence does not by itself authorize every optional administrative
  charge to increase the budget.
- **Known zero:** “free service” is not equivalent to “utility included in rent.”
  Support zero without incorrectly marking unrelated utilities as included.

All-format capture tests are passing. They prove that evidence survives into a
valid request, not that the model will classify every unsupported format
correctly. Source provenance, actual backend output, and synthetic consumer
contracts remain distinct verification layers.

## Recommended implementation sequence

1. **Protect cost correctness and listing scope.** Apply qualification/currency/
   cadence guards to all charge producers; exclude hidden/recommended source
   content; reconcile included pricing so the same amount reaches the budget
   once. Preserve actionable uncertainty as concise priced notes.
2. **Correct timing, refundability, and billing basis across normalization.**
   Route prepaid rent to existing first/last month fields; preserve deposits as
   refundable cash; carry trusted basis into household calculations. Use the
   existing “Other deposits” input when appropriate, with credit reconciliation.
   Coordinate frontend rules with the backend's existing fee contract and prompt.
3. **Add one shared semantic row reader.** Support table bodies, description
   lists, ARIA rows, bounded cards, sibling label/value pairs, heading context,
   comma clauses, and explicit USD codes. Normalize soft wraps without destroying
   real fee boundaries. Keep site-specific source precedence.
4. **Complete note and zero-cost behavior, then promote gap tests.** Preserve
   full amount qualifications and cadence, suppress headers, and retain free
   services as zero. Remove gap markers only after the corresponding workflow
   checks pass. Re-run strict tests plus the ordinary suite, including the live
   Realtor recordings, user edits/deletions, persistence, and comparison.

The investigation initially changed no production code. The subsequent fixes
and expanded regression coverage are summarized in the resolution above.
