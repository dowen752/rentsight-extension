# RentSight Engineering Guidance

These instructions apply to the entire repository.

## Think at product scope

Approach every request by asking: **What is the root cause of the user's pain point?** Do not optimize only the component, screenshot, field, or failing test immediately in front of you.

Before implementing a change, trace the relevant behavior across the complete RentSight workflow:

1. Listing capture and local extraction
2. Backend AI response contract
3. Frontend normalization and review
4. User-editable calculation inputs
5. Calculations and confirmation
6. Persistence and saved listings
7. Comparison and future conversational experiences

A locally correct change is not sufficient if it creates inconsistency, duplicated concepts, misleading actions, or additional explanation burden elsewhere in the product.

## Prefer simple, general product models

- Design for the common RentSight workflow, not for one unusual listing.
- Do not add fields, states, ranges, branches, or UI controls merely to encode a rare source format exactly.
- Keep standard user-facing inputs simple and singular when the product expects one value, such as monthly rent.
- Distinguish genuine uncertainty from different concepts. Contractual rent and promotional effective rent, for example, are not automatically a rent range or conflict.
- Preserve unusual but useful listing details as concise property notes when they do not fit the normal calculation model.
- Leave detailed scenario explanation to the conversational experience when representing it structurally would make the primary workflow harder to understand.
- Introduce new structure only when it benefits a meaningful share of listings or is required for calculation correctness, comparison integrity, safety, or a real user decision.

## Separate internal diagnostics from user decisions

Internal extraction concerns are not automatically user-facing problems.

- Do not expose schema completeness, provenance, scope, country, unit identity, evidence mechanics, or other implementation details unless the user can and should act on them.
- Prominent warnings should identify a concrete decision, correction, or risk.
- Missing optional source data should not produce repetitive warnings.
- Avoid showing both a grouped warning and individual warnings for the same condition.
- Evidence and detailed diagnostics may remain available in a secondary disclosure for auditing and troubleshooting.

## Make every action truthful and complete

- A button or option must perform what its label promises.
- If an action says a value will be added to inputs, it must update the appropriate inputs.
- If the product cannot safely apply structured data, offer an honest alternative such as keeping a property note or dismissing the suggestion.
- Follow a decision through persistence and downstream views. A kept property note should survive saving and appear wherever saved property details are consumed.

## Treat contracts as product interfaces

When changing extraction behavior, inspect both producers and consumers of the contract.

- Backend fields should map to an actual calculation, editable input, actionable review, or intentionally displayed detail.
- Frontend behavior should not render every backend diagnostic indiscriminately.
- Prefer using an existing contract cleanly before expanding it.
- Coordinate backend prompts or implementation requirements with the exact frontend behavior being introduced.
- Preserve backward compatibility when frontend and backend changes may deploy separately.

## Validate the whole experience

Tests should cover the user-visible outcome, not only a helper or response shape. When relevant, verify that:

- the correct standard value reaches its input;
- internal diagnostics stay hidden;
- meaningful unusual details become reviewable notes;
- Keep and Dismiss actions persist correctly;
- accepted values affect calculations as promised;
- saved and comparison views receive the intended data;
- ordinary listings remain straightforward after supporting an edge case.

When reporting a solution, explain the root cause addressed and the effect on the broader RentSight workflow, not just the files changed.
