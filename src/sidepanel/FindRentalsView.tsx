import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  SEARCH_CRITERION_LABELS,
  SEARCH_PROPERTY_TYPES,
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

const PROPERTY_TYPE_LABELS: Record<SearchPropertyType, string> = {
  apartment_condo: 'Apartment or condo',
  house: 'House',
  townhouse: 'Townhouse',
};

function SearchNumberInput({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  step?: number;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        min={0}
        step={step}
        value={value ?? ''}
        onChange={(event) =>
          onChange(
            event.target.value === '' ? undefined : event.target.valueAsNumber,
          )
        }
      />
    </label>
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
  openUrl = defaultOpenUrl,
  openApartments = launchApartmentsSearch,
  openRealtor = launchRealtorSearch,
  openRedfin = launchRedfinSearch,
  openRent = launchRentSearch,
  openHotpads = launchHotpadsSearch,
  openZumper = launchZumperSearch,
  openZillow = launchZillowSearch,
}: {
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
    () => (submittedSearch ? buildSearchLinks(submittedSearch) : []),
    [submittedSearch],
  );

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
    setMessage('');
    try {
      if (siteId === 'apartments' && submittedSearch) {
        const outcome = await openApartments(submittedSearch, url);
        if (outcome.message) setMessage(outcome.message);
        return;
      }
      if (siteId === 'zillow' && submittedSearch) {
        const outcome = await openZillow(submittedSearch, url);
        if (outcome.message) setMessage(outcome.message);
        return;
      }
      if (siteId === 'realtor' && submittedSearch) {
        const outcome = await openRealtor(submittedSearch, url);
        if (outcome.message) setMessage(outcome.message);
        return;
      }
      if (siteId === 'redfin' && submittedSearch) {
        const outcome = await openRedfin(submittedSearch, url);
        if (outcome.message) setMessage(outcome.message);
        return;
      }
      if (siteId === 'rent' && submittedSearch) {
        const outcome = await openRent(submittedSearch, url);
        if (outcome.message) setMessage(outcome.message);
        return;
      }
      if (siteId === 'hotpads' && submittedSearch) {
        const outcome = await openHotpads(submittedSearch, url);
        if (outcome.message) setMessage(outcome.message);
        return;
      }
      if (siteId === 'zumper' && submittedSearch) {
        const outcome = await openZumper(submittedSearch, url);
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
    }
  };

  return (
    <main className="find-workspace" aria-labelledby="find-rentals-heading">
      <header className="find-heading">
        <p className="eyebrow">Search across rental sites</p>
        <h1 id="find-rentals-heading">Find rentals</h1>
        <p>
          Enter only what matters to you. RentSight will carry each preference
          to a site when its search format supports it.
        </p>
      </header>

      <form
        className="rental-search-form"
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
          <fieldset>
            <legend>Pets</legend>
            <div className="search-check-grid">
              <label>
                <input
                  type="checkbox"
                  checked={search.catsAllowed === true}
                  onChange={(event) =>
                    update(
                      'catsAllowed',
                      event.target.checked ? true : undefined,
                    )
                  }
                />
                Cats allowed
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={search.smallDogsAllowed === true}
                  onChange={(event) =>
                    update(
                      'smallDogsAllowed',
                      event.target.checked ? true : undefined,
                    )
                  }
                />
                Small dogs allowed
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={search.largeDogsAllowed === true}
                  onChange={(event) =>
                    update(
                      'largeDogsAllowed',
                      event.target.checked ? true : undefined,
                    )
                  }
                />
                Large dogs allowed
              </label>
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
            {issues.map((issue) => (
              <p key={`${issue.criterion}-${issue.message}`}>{issue.message}</p>
            ))}
          </div>
        )}
        <div className="search-actions">
          <button
            type="submit"
            className="primary-action"
            disabled={loading || saving}
          >
            {saving ? 'Preparing…' : 'Show rental sites'}
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={() => void reset()}
          >
            Clear
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
            {results.map(({ site, result }) => (
              <article className="search-site-card" key={site.id}>
                <div>
                  <h3>{site.name}</h3>
                  <p>{site.description}</p>
                </div>
                {result.status === 'ready' ? (
                  <>
                    <div className="search-transfer-summary">
                      {result.link.applied.length > 0 ? (
                        <p>
                          <strong>
                            {result.link.transferMode === 'page'
                              ? 'Will apply:'
                              : 'Applied:'}
                          </strong>{' '}
                          {criterionList(result.link.applied)}
                        </p>
                      ) : (
                        <p>
                          No preferences can be transferred in this first
                          adapter.
                        </p>
                      )}
                      {result.link.omitted.length > 0 && (
                        <p>
                          <strong>Check on site:</strong>{' '}
                          {criterionList(result.link.omitted)}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="site-open-action"
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
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
