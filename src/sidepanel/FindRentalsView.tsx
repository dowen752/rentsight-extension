import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  SEARCH_CRITERION_LABELS,
  SEARCH_PROPERTY_TYPES,
  applyHouseholdPetFilters,
  buildSearchLinks,
  getSearchProfile,
  launchApartmentsSearch,
  launchRealtorSearch,
  launchRedfinSearch,
  launchRentSearch,
  launchHotpadsSearch,
  launchZumperSearch,
  launchZillowSearch,
  normalizeRentalSearch,
  setSearchProfile,
  type ApartmentsLaunchOutcome,
  type RentalSearch,
  type RealtorLaunchOutcome,
  type RedfinLaunchOutcome,
  type RentLaunchOutcome,
  type HotpadsLaunchOutcome,
  type ZumperLaunchOutcome,
  type SearchCriterion,
  type SearchPropertyType,
  type ZillowLaunchOutcome,
} from '../search';
import {
  DEFAULT_HOUSEHOLD_PROFILE,
  normalizeHouseholdProfile,
  type HouseholdProfile,
} from '../shared/household';

const PROPERTY_TYPE_LABELS: Record<SearchPropertyType, string> = {
  apartment_condo: 'Apartment or condo',
  house: 'House',
  townhouse: 'Townhouse',
};

function SearchNumberInput({
  label,
  value,
  onChange,
  emptyValue,
  step = 1,
  min = 0,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  emptyValue?: number;
  step?: number;
  min?: number;
}) {
  const [draft, setDraft] = useState({
    source: value,
    text: value === undefined ? '' : String(value),
  });
  const displayedValue =
    draft.source === value
      ? draft.text
      : value === undefined
        ? ''
        : String(value);

  return (
    <label>
      {label}
      <input
        type="number"
        min={min}
        step={step}
        value={displayedValue}
        onChange={(event) => {
          const nextDraft = event.target.value;
          const nextNumber = event.target.valueAsNumber;
          setDraft({
            source:
              nextDraft !== '' && Number.isFinite(nextNumber)
                ? nextNumber
                : value,
            text: nextDraft,
          });
          if (nextDraft !== '' && Number.isFinite(nextNumber))
            onChange(event.target.valueAsNumber);
        }}
        onBlur={() => {
          if (displayedValue !== '' || emptyValue === undefined) return;
          setDraft({ source: emptyValue, text: String(emptyValue) });
          onChange(emptyValue);
        }}
      />
    </label>
  );
}

function HouseholdDetails({
  profile,
  onChange,
}: {
  profile: HouseholdProfile;
  onChange: (profile: HouseholdProfile) => void;
}) {
  const update = <K extends keyof HouseholdProfile>(
    key: K,
    value: HouseholdProfile[K],
  ) => onChange(normalizeHouseholdProfile({ ...profile, [key]: value }));

  return (
    <section
      className="search-section search-household"
      aria-labelledby="search-household-heading"
    >
      <h2 id="search-household-heading">Your household</h2>
      <p>
        Your household details are saved for future searches and used to
        estimate utilities, find pet-friendly rentals, and calculate applicable
        pet costs.
      </p>
      <div className="household-fields">
        <SearchNumberInput
          label="Occupants"
          value={profile.occupants}
          min={1}
          emptyValue={1}
          onChange={(value) => update('occupants', value ?? 1)}
        />
        <SearchNumberInput
          label="Cats"
          value={profile.cats}
          emptyValue={0}
          onChange={(value) => update('cats', value ?? 0)}
        />
        <SearchNumberInput
          label="Small dogs"
          value={profile.smallDogs}
          emptyValue={0}
          onChange={(value) => update('smallDogs', value ?? 0)}
        />
        <SearchNumberInput
          label="Large dogs"
          value={profile.largeDogs}
          emptyValue={0}
          onChange={(value) => update('largeDogs', value ?? 0)}
        />
      </div>
    </section>
  );
}

function criterionList(criteria: SearchCriterion[]): string {
  return criteria
    .map((criterion) => SEARCH_CRITERION_LABELS[criterion])
    .join(', ');
}

const defaultOpenUrl = async (url: string) => {
  await chrome.tabs.create({ url });
};

export function FindRentalsView({
  householdProfile = { ...DEFAULT_HOUSEHOLD_PROFILE },
  updateHouseholdProfile = () => undefined,
  openUrl = defaultOpenUrl,
  openApartments = launchApartmentsSearch,
  openRealtor = launchRealtorSearch,
  openRedfin = launchRedfinSearch,
  openRent = launchRentSearch,
  openHotpads = launchHotpadsSearch,
  openZumper = launchZumperSearch,
  openZillow = launchZillowSearch,
}: {
  householdProfile?: HouseholdProfile;
  updateHouseholdProfile?: (profile: HouseholdProfile) => void | Promise<void>;
  openUrl?: (url: string) => Promise<unknown>;
  openApartments?: (
    search: RentalSearch,
    bootstrapUrl: string,
  ) => Promise<ApartmentsLaunchOutcome>;
  openRealtor?: (
    search: RentalSearch,
    bootstrapUrl: string,
  ) => Promise<RealtorLaunchOutcome>;
  openRedfin?: (
    search: RentalSearch,
    bootstrapUrl: string,
  ) => Promise<RedfinLaunchOutcome>;
  openRent?: (
    search: RentalSearch,
    bootstrapUrl: string,
  ) => Promise<RentLaunchOutcome>;
  openHotpads?: (
    search: RentalSearch,
    bootstrapUrl: string,
  ) => Promise<HotpadsLaunchOutcome>;
  openZumper?: (
    search: RentalSearch,
    bootstrapUrl: string,
  ) => Promise<ZumperLaunchOutcome>;
  openZillow?: (
    search: RentalSearch,
    bootstrapUrl: string,
  ) => Promise<ZillowLaunchOutcome>;
}) {
  const [search, setSearch] = useState<RentalSearch>({});
  const [submittedSearch, setSubmittedSearch] = useState<RentalSearch>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [launchingSiteIds, setLaunchingSiteIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [message, setMessage] = useState('');
  const [issues, setIssues] = useState<
    ReturnType<typeof normalizeRentalSearch>['issues']
  >([]);

  useEffect(() => {
    let active = true;
    void getSearchProfile()
      .then((profile) => {
        if (!active) return;
        setSearch(profile.search);
        if (Object.keys(profile.search).length)
          setSubmittedSearch(profile.search);
      })
      .catch((error: unknown) => {
        if (active)
          setMessage(
            error instanceof Error
              ? error.message
              : 'Could not load your rental search.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const results = useMemo(
    () =>
      submittedSearch
        ? buildSearchLinks(
            applyHouseholdPetFilters(submittedSearch, householdProfile),
          )
        : [],
    [householdProfile, submittedSearch],
  );
  const activeSearch = submittedSearch
    ? applyHouseholdPetFilters(submittedSearch, householdProfile)
    : undefined;

  const update = <K extends keyof RentalSearch>(
    key: K,
    value: RentalSearch[K],
  ) => {
    setSearch((current) => {
      const next = { ...current };
      if (
        value === undefined ||
        value === '' ||
        (Array.isArray(value) && value.length === 0)
      ) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  };

  const togglePropertyType = (propertyType: SearchPropertyType) => {
    const selected = search.propertyTypes ?? [];
    update(
      'propertyTypes',
      selected.includes(propertyType)
        ? selected.filter((item) => item !== propertyType)
        : [...selected, propertyType],
    );
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    const normalized = normalizeRentalSearch(search);
    setIssues(normalized.issues);
    if (normalized.issues.length) return;
    setSaving(true);
    try {
      await setSearchProfile(normalized.search);
      setSearch(normalized.search);
      setSubmittedSearch(normalized.search);
      setMessage('Search preferences saved. Choose a rental site below.');
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not save your rental search.',
      );
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSearch({});
    setSubmittedSearch(undefined);
    setIssues([]);
    setMessage('');
    try {
      await setSearchProfile({});
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not clear your rental search.',
      );
    }
  };

  const launch = async (siteId: string, url: string) => {
    if (launchingSiteIds.has(siteId)) return;
    setLaunchingSiteIds((current) => new Set(current).add(siteId));
    setMessage('');
    try {
      if (siteId === 'apartments' && activeSearch) {
        const outcome = await openApartments(activeSearch, url);
        if (outcome.message) setMessage(outcome.message);
        return;
      }
      if (siteId === 'zillow' && activeSearch) {
        const outcome = await openZillow(activeSearch, url);
        if (outcome.message) setMessage(outcome.message);
        return;
      }
      if (siteId === 'realtor' && activeSearch) {
        const outcome = await openRealtor(activeSearch, url);
        if (outcome.message) setMessage(outcome.message);
        return;
      }
      if (siteId === 'redfin' && activeSearch) {
        const outcome = await openRedfin(activeSearch, url);
        if (outcome.message) setMessage(outcome.message);
        return;
      }
      if (siteId === 'rent' && activeSearch) {
        const outcome = await openRent(activeSearch, url);
        if (outcome.message) setMessage(outcome.message);
        return;
      }
      if (siteId === 'hotpads' && activeSearch) {
        const outcome = await openHotpads(activeSearch, url);
        if (outcome.message) setMessage(outcome.message);
        return;
      }
      if (siteId === 'zumper' && activeSearch) {
        const outcome = await openZumper(activeSearch, url);
        if (outcome.message) setMessage(outcome.message);
        return;
      }
      await openUrl(url);
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not open that rental site.',
      );
    } finally {
      setLaunchingSiteIds((current) => {
        const next = new Set(current);
        next.delete(siteId);
        return next;
      });
    }
  };

  return (
    <main className="find-workspace" aria-labelledby="find-rentals-heading">
      <header className="find-heading">
        <p className="eyebrow">Your rental search</p>
        <h1 id="find-rentals-heading">Search setup</h1>
        <p>
          Save your household details and rental preferences, then open rental
          sites with supported filters already applied.
        </p>
      </header>

      <HouseholdDetails
        profile={householdProfile}
        onChange={(profile) => {
          void Promise.resolve(updateHouseholdProfile(profile)).catch(() =>
            setMessage('Could not save your household. Please try again.'),
          );
        }}
      />

      <form
        className="rental-search-form"
        noValidate
        onSubmit={(event) => void submit(event)}
      >
        <section
          className="search-section"
          aria-labelledby="search-basics-heading"
        >
          <h2 id="search-basics-heading">Search preferences</h2>
          <label className="search-location">
            Location
            <input
              type="text"
              value={search.location ?? ''}
              placeholder="City, state or ZIP"
              onChange={(event) => update('location', event.target.value)}
            />
          </label>
          <div className="search-field-grid">
            <SearchNumberInput
              label="Minimum listed rent"
              value={search.minListedRent}
              onChange={(value) => update('minListedRent', value)}
            />
            <SearchNumberInput
              label="Maximum listed rent"
              value={search.maxListedRent}
              onChange={(value) => update('maxListedRent', value)}
            />
            <SearchNumberInput
              label="Minimum bedrooms"
              value={search.minBedrooms}
              onChange={(value) => update('minBedrooms', value)}
            />
            <SearchNumberInput
              label="Minimum bathrooms"
              value={search.minBathrooms}
              step={0.5}
              onChange={(value) => update('minBathrooms', value)}
            />
          </div>
          <fieldset>
            <legend>Property types</legend>
            <div className="search-check-grid">
              {SEARCH_PROPERTY_TYPES.map((propertyType) => (
                <label key={propertyType}>
                  <input
                    type="checkbox"
                    checked={
                      search.propertyTypes?.includes(propertyType) ?? false
                    }
                    onChange={() => togglePropertyType(propertyType)}
                  />
                  {PROPERTY_TYPE_LABELS[propertyType]}
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <details className="review-disclosure search-more-preferences">
          <summary>
            <span>More preferences</span>
            <span className="disclosure-icon" aria-hidden="true" />
          </summary>
          <div className="review-disclosure-content">
            <label>
              Move-in date
              <input
                type="date"
                value={search.moveInDate ?? ''}
                onChange={(event) => update('moveInDate', event.target.value)}
              />
            </label>
            <SearchNumberInput
              label="Minimum square feet"
              value={search.minSquareFeet}
              onChange={(value) => update('minSquareFeet', value)}
            />
            <fieldset>
              <legend>Amenities</legend>
              <div className="search-check-grid search-amenities">
                <label>
                  <input
                    type="checkbox"
                    checked={search.parkingAvailable === true}
                    onChange={(event) =>
                      update(
                        'parkingAvailable',
                        event.target.checked ? true : undefined,
                      )
                    }
                  />
                  Parking available
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={search.inUnitLaundry === true}
                    onChange={(event) =>
                      update(
                        'inUnitLaundry',
                        event.target.checked ? true : undefined,
                      )
                    }
                  />
                  In-unit washer and dryer
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={search.airConditioning === true}
                    onChange={(event) =>
                      update(
                        'airConditioning',
                        event.target.checked ? true : undefined,
                      )
                    }
                  />
                  Air conditioning
                </label>
              </div>
            </fieldset>
          </div>
        </details>

        {issues.length > 0 && (
          <div className="search-errors" role="alert">
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="search-error-icon"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v6M12 7v.01" />
            </svg>
            <div>
              {issues.map((issue) => (
                <p key={`${issue.criterion}-${issue.message}`}>
                  {SEARCH_CRITERION_LABELS[issue.criterion]}: {issue.message}
                </p>
              ))}
            </div>
          </div>
        )}
        <div className="search-actions">
          <button
            type="submit"
            className="primary-action"
            disabled={loading || saving}
          >
            {saving ? 'Saving…' : 'Save Preferences'}
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={() => void reset()}
          >
            Clear search
          </button>
        </div>
      </form>

      {message && (
        <p className="search-message" role="status">
          {message}
        </p>
      )}

      {submittedSearch && (
        <section
          className="search-results"
          aria-labelledby="rental-sites-heading"
        >
          <div className="search-results-heading">
            <h2 id="rental-sites-heading">Rental sites</h2>
            <p>
              Each site opens in a new tab. Review its filters before browsing.
            </p>
          </div>
          <div className="search-site-list">
            {results.map(({ site, result }) => {
              const launching = launchingSiteIds.has(site.id);
              return (
                <article
                  className="search-site-card"
                  key={site.id}
                  aria-busy={launching}
                >
                  <div>
                    <div className="search-site-title">
                      <h3>{site.name}</h3>
                      {launching && (
                        <span
                          className="site-launch-spinner"
                          role="status"
                          aria-label={`Applying filters to ${site.name}`}
                        />
                      )}
                    </div>
                    <p>{site.description}</p>
                  </div>
                  {result.status === 'ready' ? (
                    <>
                      {result.link.omitted.length > 0 && (
                        <div className="search-transfer-summary">
                          <p>
                            <strong>Check on site:</strong>{' '}
                            {criterionList(result.link.omitted)}
                          </p>
                        </div>
                      )}
                      <button
                        type="button"
                        className="site-open-action"
                        disabled={launching}
                        onClick={() => void launch(site.id, result.link.url)}
                      >
                        Open {site.name}
                        <span aria-hidden="true">↗</span>
                      </button>
                    </>
                  ) : (
                    <p className="search-site-unavailable">{result.reason}</p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
