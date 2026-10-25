# Saved listing fixtures

Store sanitized HTML snapshots here as site-specific extractors are added. Fixtures should not contain personal data or remote dependencies.

## Fee coverage

Run `npm run test:fees` for local extraction, AI fee mapping, review inputs,
calculations, and saved-listing transfer/comparison coverage. Ordinary `npm test`
also runs this coverage. Tests do not contact listing websites or paid AI services.

`fees/hotpads-synthetic.html` and `fees/zumper-synthetic.html` are **synthetic
capability probes, not live-site snapshots**. They exercise the fallback pipeline
under those hostnames. They demonstrate basic prose/table support, not support
for current production markup, selected units, loading behavior, or hidden fees.
Add sanitized real listing snapshots before making a site support claim. No
site-specific extractor has been added for either site.

The previously tracked 27 strict failures now run as ordinary passing regression
tests. Cadence classification, active-property scope, refundable deposits,
prepaid rent, pet billing basis, qualifiers, and inclusive prices are covered.

The supported matrix covers zero and decimal amounts, thousands separators,
several fee labels and nested elements, monthly versus upfront sections,
required versus optional groups, duplicates, row totals versus explanatory
amounts, unknown amounts, source notes, editable review inputs, user corrections,
annual cost impact, and saved export/import/comparison. AI mapping coverage
checks exact USD amounts, aggregation, applicability, frequency, and charge basis.

`namedFeeWorkflow.test.tsx` verifies shared parsing into named recurring inputs,
property-note Keep/Dismiss decisions, editable notes, user fee corrections/removals,
local/AI reconciliation, and export/import/comparison. Required monthly utility
billing charges are now supported by the fallback and have ordinary passing tests.

## Expanded format and charge semantics corpus

See [the fee-format coverage and readiness guide](fees/formats/README.md) for
15 supported synthetic layouts and conservative charge semantics.
`feeFormats.test.tsx` checks source capture,
editable inputs, optional notes, annual cost impact, duplicate evidence,
corrections, note decisions, and saved comparison. `feeContractMatrix.test.tsx`
validates synthetic AI responses and exact evidence before testing their effect
on renter inputs and budgets. These are deterministic tests, not live model
accuracy measurements.

`feeFixWorkflow.test.tsx` adds deposit credit, price qualifier, inclusive-price,
and trusted pet basis checks through actual saving, transfer, and comparison.

`npm run test:fees:strict` must pass for current coverage. The `feeGap` helper
remains available for future unsupported formats: ordinary runs execute a
documented gap as an expected failure, while strict runs require it to pass.
The fee command includes Realtor regressions, capture, and content refresh.
