# Realtor regression evidence

`pearl-live.html` and `slick-live.html` contain the actual price, address,
bed/bath/area, and fee-row DOM read from the two live Realtor pages on
October 13, 2026. SVGs, tooltip controls, photos, ads, and contact forms were
removed; fee grouping, label/value siblings, and listing selectors were kept.
Synthetic background property cards were added to test overlay contamination.

Sources:

- https://www.realtor.com/rentals/details/3100-Pearl-Pkwy_Boulder_CO_80301_M22343-08275
- https://www.realtor.com/rentals/details/5740-Slick-Rock-Ct_Boulder_CO_80301_M13999-22785

These fixtures verify deterministic extraction and AI capture from recorded live
markup, not a live backend model response. Prices and availability may change.
General layout variations are covered in realtorExtraction.test.tsx.
