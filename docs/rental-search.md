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

The marketplace set includes Zillow, Apartments.com, Realtor.com, Redfin,
Rent.com, HotPads, and Zumper. Packaged adapters use explicit HTTPS
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
That applies rent, bedroom, bathroom, combined property-type, pet-policy,
rounded-up minimum-square-footage, parking, in-unit-laundry, and
air-conditioning preferences while leaving unsupported preferences as explicit
on-site reminders. Move-in date remains a check-on-site preference because
Apartments.com's readonly calendar has not reliably registered assisted selections.
The adapter may still attempt its calendar as a best effort, but does not promise it.
If a location-only route is ambiguous or invalid,
RentSight uses Apartments.com's own location search so the site resolves the same
first match it would offer a person typing that city name. Apartments.com access
is requested separately and only for this user-initiated launch.

Realtor.com uses the same assisted pattern. City/state locations open their
known results route directly; ambiguous text such as a city name alone is sent
through Realtor.com's visible autocomplete and its first suggestion, matching
what the site offers a person typing the same search. RentSight then opens the
single Filters drawer and applies price, minimum bedroom and whole-bathroom
ranges, combined property types, generic cat/dog policy, move-in date,
rounded-up minimum square footage, parking, and in-unit washer/dryer controls
before submitting the drawer once. RentSight's air-conditioning preference maps
to Realtor.com's Central air unit-feature control.
Realtor.com access is optional and requested only for this user-initiated flow.

Rent.com opens its homepage, selects a matching place from its own autocomplete,
then uses the full Filters dialog on the resulting rental map. Supported
criteria include price bounds, minimum whole beds/baths, property types, cats,
generic dog acceptance for either requested dog size, and Pet Friendly when
both cats and dogs are requested,
move-in date via its calendar, rounded-up square footage, in-unit laundry, and
air conditioning. Its Garage filter is narrower than general parking, so parking
remains an on-site check. Dogs OK does not guarantee a particular size allowance;
users should confirm any size restrictions with the listing. A bare city uses
the site's first matching place with a state-review
reminder. This assisted flow requests separate optional Rent.com access.

HotPads also starts with its own location autocomplete instead of a generated
city slug, which avoids valid cities reaching an Area not found page. On the
resolved results page RentSight applies minimum/maximum price, whole-number
bedroom and bathroom minimums, property types, square footage, move-in date,
cats, generic dogs for either requested dog size, parking, in-unit laundry, and
air conditioning through HotPads' visible controls before submitting once.
This flow requests separate optional HotPads access.

Zumper begins on its landing page and resolves the requested place through its
own autocomplete. On the results page RentSight applies Beds/Baths, Price,
Type, Pets, and More as separate filter groups, waiting for each group to retain
its state before continuing. Supported preferences are price bounds, minimum
whole beds and baths, property types, cats, generic dogs for either requested
dog size, minimum square footage, in-unit laundry, and air conditioning.
Zumper has no matching move-in control, and its Garage/Assigned options are
narrower than general parking, so those preferences remain explicit on-site
checks. This flow requests optional Zumper access only when launched.

Redfin starts on its rental landing page and resolves a precise city/state via
the site's own search suggestions, avoiding opaque city IDs in generated URLs.
The rental Filters dialog applies price bounds, minimum beds/baths, property
types, pets, date, rounded-up square footage, parking, in-unit laundry, and
air conditioning. A bare city uses the site's first matching city suggestion,
with an explicit reminder to verify the selected state. Site access is optional and requested only
for this user-initiated search.

The Find form has no required fields or repetitive optional labels, keeps advanced
preferences collapsed, persists a versioned local profile, and opens only the
user-selected external search. Listing inspection, confirmation, saving, and
comparison retain their existing behavior. Automated tests have no live-network
dependency.

## Next implementation steps

1. Manually verify every generated search in Chrome across city/state and ZIP
   locations, then adjust adapters when a marketplace rejects or broadens a URL.
2. Redfin resolves city/state locations through its own suggestions and fills
   supported rental filters in its dialog; verify additional location formats
   before extending beyond city/state.
3. Add other site-specific page filling only where stable URLs cannot carry
   important preferences, with separately reviewed optional permissions and
   visible-state verification.

AI filling, alerts, and listing matching remain outside this foundation.
