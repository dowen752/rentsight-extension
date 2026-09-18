# Rental search foundation

The search profile represents renter preferences, separately from extracted
listing facts, household assumptions, saved analyses, and calculation inputs.
Every criterion is optional, including location. An empty search or a search for
maximum listed rent plus parking is valid. Individual marketplaces may require
location; adapters must return an honest unavailable result rather than impose
that requirement on the shared model or silently ignore preferences.

## Contract semantics

- Location is a single text entry; structured geocoding and radius are deferred.
- Rent is monthly listed price, not RentSight's estimated true housing cost.
- Bedrooms and bathrooms are minimums, not exact counts. Zero bedrooms permits
  studios. Bathrooms use half increments.
- Property types are apartment/condo, house, and townhouse. Empty means any.
- Cats, small dogs, and large dogs are independent positive requirements.
  Unchecked means no preference, not pets prohibited. A marketplace with only
  a generic dog filter may satisfy either selected dog-size preference with
  that broader control and must report each transferred preference honestly.
- Move-in date is a desired ISO calendar date; availability is not guaranteed.
- Square footage is minimum interior area, in square feet.
- Parking means available at the property, not free/reserved/covered parking or
  a specific count of spaces.
- In-unit laundry means a washer and dryer provided inside the unit. Hookups or
  shared laundry do not meet the criterion.
- Air conditioning means any provided AC, not necessarily central AC.

Normalization removes empty selections and reports invalid data. Consumers must
handle validation issues before launching links; they must not silently swap rent
bounds, round bedroom counts, or turn malformed values into broader searches.
The version-2 profile is stored locally under `searchProfile` and is removed by
the existing clear-all-data action. Version-1 generic dog preferences migrate
to both small- and large-dog preferences. There is no backend or
extraction-contract change, and search preferences must not overwrite
calculation inputs.

## Current implementation

The initial marketplace set includes Zillow, Apartments.com, Realtor.com, Redfin,
Rent.com, HotPads, Zumper, and RentCafe. Packaged adapters use explicit HTTPS
origin allowlists and report only requested criteria their launch strategy
actually transfers. All remaining requested criteria are shown as on-site
reminders. Unsupported in-unit laundry, for example, never becomes
shared-laundry filtering.

Zillow uses an assisted two-stage launch because a URL containing filter state
can render correct filter pills with an incorrect zero-result response.
RentSight first opens the canonical unfiltered location route and then uses
Zillow's own visible controls to apply rent, bedroom, bathroom, square-footage,
cat, small-dog, large-dog, parking, in-unit-laundry, and air-conditioning
preferences. This requires the narrowly declared optional Zillow host
permission, requested only from the user-initiated Zillow launch. Denial or
failure leaves the correct unfiltered location page open and tells the user to
review filters there.

Apartments.com also uses an assisted launch because fully composed filter routes
can resolve to an error page. RentSight opens the canonical location-results
route, then uses its Price, Beds/Baths, Home Type, and All Filters controls.
Move-in date is carried in Apartments.com's native `mid=YYYYMMDD` search
parameter because its calendar ignores synthetic day clicks. The remaining
controls apply rent, bedroom, bathroom, combined property-type, pet-policy,
rounded-up minimum-square-footage, parking, in-unit-laundry, and air-conditioning
preferences while leaving unsupported preferences as explicit on-site reminders.
If a location-only route is ambiguous or invalid, RentSight uses Apartments.com's
own location search so the site resolves the same first match it would offer a
person typing that city name, then restores the move-in-date parameter if that
navigation removed it. Apartments.com access is requested separately and only
for this user-initiated launch.

The Find form has no required fields or repetitive optional labels, keeps advanced
preferences collapsed, persists a versioned local profile, and opens only the
user-selected external search. Listing inspection, confirmation, saving, and
comparison retain their existing behavior. Automated tests have no live-network
dependency.

## Next implementation steps

1. Manually verify every generated search in Chrome across city/state and ZIP
   locations, then adjust adapters when a marketplace rejects or broadens a URL.
2. Expand the Realtor.com, Rent.com, Zumper, and RentCafe adapters with additional
   filters only after their exact minimum-versus-exact semantics are verified.
3. Resolve Redfin locations to its internal geographic routes; until then its card
   truthfully sends all criteria to the on-site review list.
4. Add other site-specific page filling only where stable URLs cannot carry
   important preferences, with separately reviewed optional permissions and
   visible-state verification.

AI filling, alerts, and listing matching remain outside this foundation.
