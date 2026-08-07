import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  calculateEffectiveMonthlyRent,
  calculateEstimatedTrueMonthlyCost,
  calculateFirstYearHousingCost,
  calculateNonrefundableMoveInExpenses,
  calculateRefundableDeposits,
  calculateRequiredMoveInCash,
  listMissingCostCategories,
  validateRentalListing,
  type ListingIdentity,
  type RecurringCosts,
  type RentConcessions,
  type UpfrontCosts,
  type UtilityCategory,
} from '../calculations';
import {
  createInitialAnalysis,
  applyInternetPreference,
  applyExtraction,
  applyLocationEstimate,
  clearField,
  materializeListing,
  resetField,
  resetUtility,
  setConcessionValue,
  setIdentityValue,
  setRecurringValue,
  setUpfrontValue,
  setUtilityIncluded,
  UTILITY_CATEGORIES,
  type CustomFee,
  type RentalAnalysis,
} from '../shared/analysis';
import type { ExtensionResponse } from '../shared/messages';
import { isExtractionUpdatedMessage } from '../shared/messages';
import {
  extensionStorage,
  getRentalAnalysis,
  persistSavedListings,
  setRentalAnalysis,
} from '../storage';
import { NumberField, TextField } from './Fields';
import {
  createComparison,
  deleteListing,
  exportListingsCsv,
  exportListingsJson,
  importListingsJson,
  mergeImportedListings,
  migrateSavedRecords,
  saveListing,
  type SavedListingRecord,
} from '../saved';
import {
  estimateLocation,
  LocalGeocodingProvider,
  LocalRegionalUtilityProvider,
  MockRentBenchmarkProvider,
  locationCacheKey,
  type LocationCache,
} from '../location';
import { analysisForNavigation } from './navigationState';

type ViewState =
  | { status: 'loading' }
  | { status: 'unit-selection-required' }
  | { status: 'unsupported'; url: string; title: string }
  | {
      status: 'ready';
      url: string;
      analysis: RentalAnalysis;
      savedListings: SavedListingRecord[];
    }
  | { status: 'error'; message: string };

const MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const UTILITY_LABELS: Record<UtilityCategory, string> = {
  electricity: 'Electricity',
  naturalGas: 'Gas',
  water: 'Water',
  sewer: 'Sewer',
  trash: 'Trash',
  internet: 'Internet',
};

interface FeeEditorProps {
  title: string;
  fees: CustomFee[];
  onChange: (fees: CustomFee[]) => void;
}

function FeeEditor({ title, fees, onChange }: FeeEditorProps) {
  const addFee = () => {
    onChange([...fees, { id: crypto.randomUUID(), label: '', amount: 0 }]);
  };
  return (
    <div className="custom-fees">
      {fees.map((fee, index) => (
        <div className="custom-fee" key={fee.id}>
          <label>
            Fee name
            <input
              value={fee.label}
              onChange={(event) =>
                onChange(
                  fees.map((item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, label: event.target.value }
                      : item,
                  ),
                )
              }
            />
          </label>
          <label>
            Amount
            <input
              type="number"
              min="0"
              value={fee.amount}
              onChange={(event) =>
                onChange(
                  fees.map((item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, amount: event.target.valueAsNumber || 0 }
                      : item,
                  ),
                )
              }
            />
          </label>
          <span className="source source-user">Entered by user</span>
          <button
            type="button"
            className="remove"
            onClick={() => onChange(fees.filter((item) => item.id !== fee.id))}
          >
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="add" onClick={addFee}>
        + {title}
      </button>
    </div>
  );
}

function ReviewDisclosure({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <details className="review-disclosure">
      <summary>
        <span>{title}</span>
        <span className="disclosure-icon" aria-hidden="true" />
      </summary>
      <div className="review-disclosure-content">{children}</div>
    </details>
  );
}

export function App() {
  const [view, setView] = useState<ViewState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    async function load(): Promise<void> {
      try {
        const response = (await chrome.runtime.sendMessage({
          type: 'GET_PAGE_INFO',
        })) as ExtensionResponse;
        if (!active) return;
        if (response.type === 'EXTENSION_ERROR') {
          setView({ status: 'error', message: response.error });
          return;
        }
        if (response.payload.requiresUnitSelection) {
          setView({ status: 'unit-selection-required' });
          return;
        }
        if (!response.payload.appearsToBeRentalListing) {
          setView({
            status: 'unsupported',
            url: response.payload.url,
            title: response.payload.title,
          });
          return;
        }
        const [saved, storedRecords, storedInternetCost] = await Promise.all([
          getRentalAnalysis(response.payload.url),
          extensionStorage.get('savedListings'),
          extensionStorage.get('internetMonthlyCost'),
        ]);
        let analysis =
          saved ??
          createInitialAnalysis(response.payload.url, response.payload.title);
        if (response.payload.extraction) {
          analysis = applyExtraction(analysis, response.payload.extraction);
        }
        const legacyInternetCost =
          !analysis.utilityIncluded.internet &&
          analysis.listing.recurring.internet?.source === 'user'
            ? analysis.listing.recurring.internet.value
            : undefined;
        const internetCost = storedInternetCost ?? legacyInternetCost;
        if (
          storedInternetCost === undefined &&
          legacyInternetCost !== undefined
        )
          await extensionStorage.set('internetMonthlyCost', legacyInternetCost);
        analysis = applyInternetPreference(analysis, internetCost);
        let savedListings: SavedListingRecord[] = [];
        try {
          savedListings = migrateSavedRecords(storedRecords);
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : 'Unknown storage error.';
          throw new Error(`Saved listings could not be loaded: ${message}`, {
            cause: error,
          });
        }
        if (active)
          setView({
            status: 'ready',
            url: response.payload.url,
            analysis,
            savedListings,
          });
      } catch (error: unknown) {
        if (!active) return;
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to load this listing.';
        console.error('[RentSight] Side panel initialization failed', error);
        setView({ status: 'error', message });
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    let navigationRevision = 0;
    const listener = (
      message: unknown,
      sender: chrome.runtime.MessageSender,
    ) => {
      if (!isExtractionUpdatedMessage(message)) return;
      void chrome.tabs
        .query({ active: true, currentWindow: true })
        .then(([tab]) => {
          if (!active || !sender.tab?.id || sender.tab.id !== tab?.id) return;
          if (message.payload.requiresUnitSelection) {
            setView({ status: 'unit-selection-required' });
            return;
          }
          if (!message.payload.appearsToBeRentalListing) {
            setView({
              status: 'unsupported',
              url: message.payload.url,
              title: message.payload.title,
            });
            return;
          }
          if (message.payload.selectedUnitId) {
            window.location.reload();
            return;
          }
          const revision = ++navigationRevision;
          void Promise.all([
            getRentalAnalysis(message.payload.url),
            extensionStorage.get('internetMonthlyCost'),
          ]).then(([stored, internetCost]) => {
            if (!active || revision !== navigationRevision) return;
            setView((current) =>
              current.status === 'ready'
                ? {
                    ...current,
                    url: message.payload.url,
                    analysis: applyInternetPreference(
                      analysisForNavigation(
                        current.url === message.payload.url
                          ? current.analysis
                          : undefined,
                        message.payload.url,
                        message.payload.title,
                        message.payload.extraction,
                        stored ? { [message.payload.url]: stored } : undefined,
                      ),
                      internetCost,
                    ),
                  }
                : current,
            );
          });
        });
    };
    chrome.runtime.onMessage.addListener(listener);
    const activeTabListener = (activeInfo: { tabId: number }) => {
      void chrome.tabs
        .query({ active: true, currentWindow: true })
        .then(([tab]) => {
          if (tab?.id === activeInfo.tabId) window.location.reload();
        });
    };
    chrome.tabs.onActivated.addListener(activeTabListener);
    return () => {
      active = false;
      chrome.runtime.onMessage.removeListener(listener);
      chrome.tabs.onActivated.removeListener(activeTabListener);
    };
  }, []);

  useEffect(() => {
    if (view.status !== 'ready') return;
    const timeout = window.setTimeout(() => {
      void setRentalAnalysis(view.url, view.analysis).catch((error: unknown) =>
        console.error('[RentSight] Could not save listing analysis', error),
      );
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [view]);

  const locationAddress =
    view.status === 'ready'
      ? view.analysis.listing.identity.fullAddress?.value
      : undefined;
  const locationCity =
    view.status === 'ready'
      ? view.analysis.listing.identity.city?.value
      : undefined;
  const locationState =
    view.status === 'ready'
      ? view.analysis.listing.identity.state?.value
      : undefined;
  const locationZip =
    view.status === 'ready'
      ? view.analysis.listing.identity.zipCode?.value
      : undefined;
  const locationBedrooms =
    view.status === 'ready'
      ? view.analysis.listing.identity.bedrooms?.value
      : undefined;
  const locationQuery = useMemo(
    () => ({
      address: locationAddress,
      city: locationCity,
      state: locationState,
      zipCode: locationZip,
    }),
    [locationAddress, locationCity, locationState, locationZip],
  );
  const currentLocationKey = locationCacheKey(locationQuery);

  useEffect(() => {
    if (view.status !== 'ready' || !currentLocationKey) return;
    let active = true;
    const cache: LocationCache = {
      async get(key) {
        return (await extensionStorage.get('locationCache'))?.[key];
      },
      async set(key, value) {
        const current = (await extensionStorage.get('locationCache')) ?? {};
        await extensionStorage.set('locationCache', {
          ...current,
          [key]: value,
        });
      },
    };
    void estimateLocation(locationQuery, locationBedrooms, {
      geocoding: new LocalGeocodingProvider(),
      utilities: new LocalRegionalUtilityProvider(),
      rentBenchmarks: new MockRentBenchmarkProvider(),
      cache,
    })
      .then((estimate) => {
        if (!active || !estimate) return;
        setView((current) =>
          current.status === 'ready'
            ? {
                ...current,
                analysis: applyLocationEstimate(current.analysis, estimate),
              }
            : current,
        );
      })
      .catch((error: unknown) =>
        console.warn('[RentSight] Location could not be resolved', error),
      );
    return () => {
      active = false;
    };
  }, [currentLocationKey, locationBedrooms, locationQuery, view.status]);

  const update = (transform: (analysis: RentalAnalysis) => RentalAnalysis) => {
    setView((current) => {
      if (current.status !== 'ready') return current;
      const next = transform(current.analysis);
      const previousInternet = current.analysis.listing.recurring.internet;
      const nextInternet = next.listing.recurring.internet;
      const inclusionChanged =
        current.analysis.utilityIncluded.internet !==
        next.utilityIncluded.internet;
      if (
        !inclusionChanged &&
        (previousInternet?.value !== nextInternet?.value ||
          previousInternet?.source !== nextInternet?.source)
      ) {
        const write =
          nextInternet?.source === 'user'
            ? extensionStorage.set('internetMonthlyCost', nextInternet.value)
            : extensionStorage.remove('internetMonthlyCost');
        void write.catch((error: unknown) =>
          console.error(
            '[RentSight] Could not save internet preference',
            error,
          ),
        );
      }
      return { ...current, analysis: next };
    });
  };

  const setSavedListings = async (
    savedListings: SavedListingRecord[],
  ): Promise<void> => {
    if (view.status !== 'ready') return;

    // Start the durable write in the same event as the user's change. Waiting
    // for a React effect leaves a window where closing or refreshing the panel
    // can happen before Chrome receives the storage request.
    await persistSavedListings(savedListings);

    const stored = migrateSavedRecords(
      await extensionStorage.get('savedListings'),
    );
    const expectedIds = savedListings.map((record) => record.id).sort();
    const storedIds = stored.map((record) => record.id).sort();
    if (JSON.stringify(storedIds) !== JSON.stringify(expectedIds)) {
      throw new Error('Chrome did not retain the saved-listing collection.');
    }

    setView((current) =>
      current.status === 'ready' ? { ...current, savedListings } : current,
    );
  };

  if (view.status === 'loading') {
    return (
      <main>
        <p className="status neutral">Loading listing analysis…</p>
      </main>
    );
  }
  if (view.status === 'error') {
    return (
      <main>
        <p className="status error">{view.message}</p>
      </main>
    );
  }
  if (view.status === 'unit-selection-required') {
    return (
      <main>
        <section className="warning">
          <h1>Select a unit first</h1>
          <p>
            Zillow community pages can contain many units with different rents,
            dimensions, fees, and availability. Choose a listing before using
            RentSight.
          </p>
          <button
            type="button"
            className="primary-action"
            onClick={() => window.location.reload()}
          >
            Check again
          </button>
        </section>
      </main>
    );
  }
  if (view.status === 'unsupported') {
    const openManualEntry = async () => {
      try {
        const [storedAnalysis, storedRecords, internetCost] = await Promise.all(
          [
            getRentalAnalysis(view.url),
            extensionStorage.get('savedListings'),
            extensionStorage.get('internetMonthlyCost'),
          ],
        );
        setView({
          status: 'ready',
          url: view.url,
          analysis: applyInternetPreference(
            storedAnalysis ?? createInitialAnalysis(view.url, view.title),
            internetCost,
          ),
          savedListings: migrateSavedRecords(storedRecords),
        });
      } catch (error: unknown) {
        setView({
          status: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Unable to start manual entry.',
        });
      }
    };
    return (
      <main>
        <section className="warning">
          <h1>This does not look like a rental listing</h1>
          <p>Open a rental listing, or start with a blank analysis.</p>
          <button
            type="button"
            className="primary-action"
            onClick={() => void openManualEntry()}
          >
            Enter details manually
          </button>
        </section>
      </main>
    );
  }

  return (
    <Workspace
      analysis={view.analysis}
      savedListings={view.savedListings}
      update={update}
      setSavedListings={setSavedListings}
    />
  );
}

type WorkspaceTab = 'current' | 'saved' | 'compare';

function Workspace({
  analysis,
  savedListings,
  update,
  setSavedListings,
}: {
  analysis: RentalAnalysis;
  savedListings: SavedListingRecord[];
  update: (transform: (analysis: RentalAnalysis) => RentalAnalysis) => void;
  setSavedListings: (records: SavedListingRecord[]) => Promise<void>;
}) {
  const [tab, setTab] = useState<WorkspaceTab>('current');
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const currentUrl = analysis.listing.identity.url?.value;
  const currentSaved = savedListings.find(
    (record) => record.url === currentUrl,
  );

  const saveCurrent = async () => {
    try {
      const result = saveListing(savedListings, analysis);
      await setSavedListings(result.records);
      setNotice(result.created ? 'Listing saved.' : 'Saved listing updated.');
    } catch (error: unknown) {
      setNotice(
        error instanceof Error ? error.message : 'Could not save listing.',
      );
    }
  };

  return (
    <>
      <nav className="workspace-tabs" aria-label="RentSight views">
        {(['current', 'saved', 'compare'] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-current={tab === item ? 'page' : undefined}
            onClick={() => setTab(item)}
          >
            {item === 'current'
              ? 'Current'
              : item === 'saved'
                ? `Saved (${savedListings.length})`
                : `Compare (${selected.length})`}
          </button>
        ))}
      </nav>
      {notice && (
        <p className="workspace-notice" role="status">
          {notice}
        </p>
      )}
      {tab === 'current' && (
        <AnalysisEditor
          analysis={analysis}
          update={update}
          toolbar={
            <button
              type="button"
              className="primary-action"
              onClick={() => void saveCurrent()}
            >
              {currentSaved ? 'Update saved listing' : 'Save this listing'}
            </button>
          }
        />
      )}
      {tab === 'saved' && (
        <SavedListingsView
          records={savedListings}
          selected={selected}
          setSelected={setSelected}
          setRecords={setSavedListings}
          setNotice={setNotice}
          openCompare={() => setTab('compare')}
        />
      )}
      {tab === 'compare' && (
        <ComparisonView
          records={savedListings.filter((record) =>
            selected.includes(record.id),
          )}
        />
      )}
    </>
  );
}

function downloadData(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function SavedListingsView({
  records,
  selected,
  setSelected,
  setRecords,
  setNotice,
  openCompare,
}: {
  records: SavedListingRecord[];
  selected: string[];
  setSelected: (ids: string[]) => void;
  setRecords: (records: SavedListingRecord[]) => Promise<void>;
  setNotice: (notice: string) => void;
  openCompare: () => void;
}) {
  const selectedRecords = records.filter((record) =>
    selected.includes(record.id),
  );
  const exportedRecords = selectedRecords.length ? selectedRecords : records;
  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      const result = importListingsJson(await file.text());
      if (result.records.length) {
        await setRecords(mergeImportedListings(records, result.records));
      }
      setNotice(
        result.errors.length
          ? result.errors.join(' ')
          : `Imported ${result.records.length} listing${result.records.length === 1 ? '' : 's'}.`,
      );
    } catch (error: unknown) {
      setNotice(
        error instanceof Error ? error.message : 'Could not import listings.',
      );
    }
  };
  return (
    <main>
      <header>
        <span className="eyebrow">Your shortlist</span>
        <h1>Saved listings</h1>
        <p>
          Select listings to compare or export. Saved records stay in this
          Chrome profile.
        </p>
      </header>
      <div className="collection-actions">
        <button
          type="button"
          className="primary-action"
          disabled={selected.length < 2}
          onClick={openCompare}
        >
          Compare selected
        </button>
        <button
          type="button"
          onClick={() =>
            downloadData(
              'rentsight-listings.json',
              exportListingsJson(exportedRecords),
              'application/json',
            )
          }
        >
          Export JSON
        </button>
        <button
          type="button"
          onClick={() =>
            downloadData(
              'rentsight-listings.csv',
              exportListingsCsv(exportedRecords),
              'text/csv',
            )
          }
        >
          Export CSV
        </button>
        <label className="import-button">
          Import JSON
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => void importFile(event.target.files?.[0])}
          />
        </label>
      </div>
      {records.length === 0 ? (
        <section>
          <h2>No saved listings yet</h2>
          <p>Return to Current and save an analysis to start a shortlist.</p>
        </section>
      ) : (
        records.map((record) => {
          const item = createComparison(record);
          return (
            <section className="saved-card" key={record.id}>
              <label className="saved-select">
                <input
                  type="checkbox"
                  checked={selected.includes(record.id)}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked
                        ? [...selected, record.id]
                        : selected.filter((id) => id !== record.id),
                    )
                  }
                />{' '}
                Select for comparison
              </label>
              <h2>{item.address}</h2>
              <p>
                {MONEY.format(item.trueMonthlyCost)} estimated monthly ·{' '}
                {item.completeness.score}% data completeness
              </p>
              <div className="saved-actions">
                <a href={record.url} target="_blank" rel="noreferrer">
                  Open listing
                </a>
                <button
                  type="button"
                  className="remove"
                  onClick={async () => {
                    try {
                      await setRecords(deleteListing(records, record.id));
                      setSelected(selected.filter((id) => id !== record.id));
                      setNotice('Saved listing deleted.');
                    } catch (error: unknown) {
                      setNotice(
                        error instanceof Error
                          ? error.message
                          : 'Could not delete the saved listing.',
                      );
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </section>
          );
        })
      )}
    </main>
  );
}

const comparisonRows: readonly [
  string,
  keyof ReturnType<typeof createComparison>,
  'money' | 'number' | 'score',
][] = [
  ['Advertised rent', 'advertisedRent', 'money'],
  ['True monthly cost', 'trueMonthlyCost', 'money'],
  ['Difference', 'monthlyDifference', 'money'],
  ['Move-in cash', 'moveInCash', 'money'],
  ['First-year total', 'firstYearTotal', 'money'],
  ['Bedrooms', 'bedrooms', 'number'],
  ['Bathrooms', 'bathrooms', 'number'],
  ['Square feet', 'squareFootage', 'number'],
  ['Cost / sq. ft.', 'costPerSquareFoot', 'money'],
  ['Utilities', 'utilities', 'money'],
  ['Parking', 'parking', 'money'],
  ['Laundry', 'laundry', 'money'],
  ['Pet expenses', 'petExpenses', 'money'],
  ['Data completeness', 'completeness', 'score'],
];

function ComparisonView({ records }: { records: SavedListingRecord[] }) {
  const items = records.map(createComparison);
  return (
    <main className="comparison-page">
      <header>
        <span className="eyebrow">Side-by-side</span>
        <h1>Compare listings</h1>
        <p>
          Data completeness reflects known versus estimated fields. It is not a
          financial recommendation.
        </p>
      </header>
      {items.length < 2 ? (
        <section>
          <h2>Select at least two listings</h2>
          <p>Use the Saved view to choose listings for comparison.</p>
        </section>
      ) : (
        <div
          className="comparison-scroll"
          tabIndex={0}
          aria-label="Listing comparison table"
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Metric</th>
                {items.map((item) => (
                  <th scope="col" key={item.id}>
                    {item.address}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map(([label, key, format]) => (
                <tr key={key}>
                  <th scope="row">{label}</th>
                  {items.map((item) => {
                    const value = item[key];
                    let display = 'Unknown';
                    if (
                      format === 'score' &&
                      typeof value === 'object' &&
                      value &&
                      'score' in value
                    )
                      display = `${value.score}%`;
                    else if (typeof value === 'number')
                      display =
                        format === 'money'
                          ? MONEY.format(value)
                          : String(value);
                    return <td key={item.id}>{display}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

interface AnalysisEditorProps {
  analysis: RentalAnalysis;
  update: (transform: (analysis: RentalAnalysis) => RentalAnalysis) => void;
  toolbar?: ReactNode;
}

export function AnalysisEditor({
  analysis,
  update: updateAnalysis,
  toolbar,
}: AnalysisEditorProps) {
  const [confirmedRevision, setConfirmedRevision] = useState<
    string | undefined
  >();
  const confirmed = confirmedRevision === analysis.updatedAt;
  const listing = useMemo(() => materializeListing(analysis), [analysis]);
  const validation = useMemo(() => validateRentalListing(listing), [listing]);
  const results = useMemo(() => {
    if (!confirmed || !validation.valid) return undefined;
    return {
      monthly: calculateEstimatedTrueMonthlyCost(listing),
      moveIn: calculateRequiredMoveInCash(listing),
      deposits: calculateRefundableDeposits(listing),
      nonrefundable: calculateNonrefundableMoveInExpenses(listing),
      firstYear: calculateFirstYearHousingCost(listing),
      effective: calculateEffectiveMonthlyRent(listing),
      missing: listMissingCostCategories(listing),
    };
  }, [confirmed, listing, validation.valid]);

  const update = (
    transform: (analysis: RentalAnalysis) => RentalAnalysis,
  ): void => {
    setConfirmedRevision(undefined);
    updateAnalysis(transform);
  };

  const identity = <K extends keyof ListingIdentity>(
    key: K,
    value: NonNullable<ListingIdentity[K]>['value'],
  ) =>
    update((current) =>
      typeof value === 'string' && value.trim() === ''
        ? clearField(current, 'identity', key)
        : setIdentityValue(current, key, value),
    );
  const numericIdentity = (
    key: 'bedrooms' | 'bathrooms' | 'squareFootage',
    value: number | undefined,
  ) =>
    update((current) =>
      value === undefined
        ? clearField(current, 'identity', key)
        : setIdentityValue(current, key, value),
    );
  const recurring = (key: keyof RecurringCosts, value: number | undefined) =>
    update((current) =>
      value === undefined
        ? clearField(current, 'recurring', key)
        : setRecurringValue(current, key, value),
    );
  const upfront = (key: keyof UpfrontCosts, value: number | undefined) =>
    update((current) =>
      value === undefined
        ? clearField(current, 'upfront', key)
        : setUpfrontValue(current, key, value),
    );
  const concession = (key: keyof RentConcessions, value: number | undefined) =>
    update((current) =>
      value === undefined
        ? clearField(current, 'concessions', key)
        : setConcessionValue(current, key, value),
    );
  const reset = (
    group: 'identity' | 'recurring' | 'upfront' | 'concessions',
    key: string,
  ) => update((current) => resetField(current, group, key));

  return (
    <main>
      <header>
        <span className="eyebrow">
          {confirmed ? 'Step 2 · Results' : 'Step 1 · Review inputs'}
        </span>
        <h1>RentSight</h1>
        <p>
          {confirmed
            ? 'Your results use the values you reviewed and confirmed.'
            : 'Check every extracted or estimated value. You can edit any field before calculating.'}
        </p>
      </header>
      {confirmed && toolbar && (
        <div className="analysis-toolbar">{toolbar}</div>
      )}

      {!confirmed && analysis.locationEstimate && (
        <section className="location-note" aria-labelledby="location-heading">
          <h2 id="location-heading">Local estimate context</h2>
          <p>
            {analysis.locationEstimate.location.city},{' '}
            {analysis.locationEstimate.location.state}{' '}
            {analysis.locationEstimate.location.zipCode}: utility assumptions
            adjusted{' '}
            {analysis.locationEstimate.utilityAdjustmentFactor.toFixed(2)}×
            using local configuration.
          </p>
        </section>
      )}

      {!confirmed && !validation.valid && (
        <section className="warning" aria-labelledby="validation-heading">
          <h2 id="validation-heading">Fix these values</h2>
          <ul>
            {validation.errors.map((error) => (
              <li key={error.path}>{error.message}</li>
            ))}
          </ul>
        </section>
      )}

      {!confirmed && analysis.extraction?.warnings.length ? (
        <section className="warning" aria-labelledby="extraction-heading">
          <h2 id="extraction-heading">Extraction needs review</h2>
          <ul>
            {analysis.extraction.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {!confirmed && (
        <section className="review-intro" aria-labelledby="review-heading">
          <h2 id="review-heading">Review extracted values</h2>
          <p>
            Source badges show where each value came from. Missing and estimated
            values deserve extra attention before confirmation.
          </p>
        </section>
      )}

      {!confirmed && (
        <section aria-labelledby="summary-heading">
          <h2 id="summary-heading">Listing summary</h2>
          <TextField
            label="Listing name (optional)"
            field={analysis.listing.identity.listingTitle}
            baseline={analysis.baseline.identity.listingTitle}
            onChange={(value) => identity('listingTitle', value)}
            onReset={() => reset('identity', 'listingTitle')}
            placeholder="Give this property any name you like"
          />
          <TextField
            label="Address"
            field={analysis.listing.identity.fullAddress}
            baseline={analysis.baseline.identity.fullAddress}
            onChange={(value) => identity('fullAddress', value)}
            onReset={() => reset('identity', 'fullAddress')}
          />
          <div className="columns-two">
            <TextField
              label="City"
              field={analysis.listing.identity.city}
              baseline={analysis.baseline.identity.city}
              onChange={(value) => identity('city', value)}
              onReset={() => reset('identity', 'city')}
            />
            <TextField
              label="State"
              field={analysis.listing.identity.state}
              baseline={analysis.baseline.identity.state}
              onChange={(value) => identity('state', value)}
              onReset={() => reset('identity', 'state')}
            />
          </div>
          <TextField
            label="ZIP code"
            field={analysis.listing.identity.zipCode}
            baseline={analysis.baseline.identity.zipCode}
            onChange={(value) => identity('zipCode', value)}
            onReset={() => reset('identity', 'zipCode')}
          />
          <NumberField
            label="Monthly rent"
            prefix="$"
            field={analysis.listing.recurring.advertisedRent}
            baseline={analysis.baseline.recurring.advertisedRent}
            onChange={(value) => recurring('advertisedRent', value)}
            onReset={() => reset('recurring', 'advertisedRent')}
          />
          <div className="columns-two">
            <NumberField
              label="Bedrooms"
              step={0.5}
              field={analysis.listing.identity.bedrooms}
              baseline={analysis.baseline.identity.bedrooms}
              onChange={(value) => numericIdentity('bedrooms', value)}
              onReset={() => reset('identity', 'bedrooms')}
            />
            <NumberField
              label="Bathrooms"
              step={0.5}
              field={analysis.listing.identity.bathrooms}
              baseline={analysis.baseline.identity.bathrooms}
              onChange={(value) => numericIdentity('bathrooms', value)}
              onReset={() => reset('identity', 'bathrooms')}
            />
          </div>
          <NumberField
            label="Square feet"
            field={analysis.listing.identity.squareFootage}
            baseline={analysis.baseline.identity.squareFootage}
            onChange={(value) => numericIdentity('squareFootage', value)}
            onReset={() => reset('identity', 'squareFootage')}
          />
          <TextField
            label="Listing URL"
            type="url"
            field={analysis.listing.identity.url}
            baseline={analysis.baseline.identity.url}
            onChange={(value) => identity('url', value)}
            onReset={() => reset('identity', 'url')}
          />
        </section>
      )}

      {!confirmed && (
        <ReviewDisclosure title="Utilities">
          <div className="utility-list">
            {UTILITY_CATEGORIES.map((category) => (
              <div className="utility" key={category}>
                <NumberField
                  label={UTILITY_LABELS[category]}
                  prefix="$"
                  field={analysis.listing.recurring[category]}
                  baseline={analysis.baseline.recurring[category]}
                  disabled={analysis.utilityIncluded[category]}
                  allowReset={category === 'internet'}
                  onChange={(value) => recurring(category, value)}
                  onReset={() =>
                    update((current) => resetUtility(current, category))
                  }
                />
                <label className="included">
                  <input
                    type="checkbox"
                    checked={analysis.utilityIncluded[category]}
                    onChange={(event) =>
                      update((current) =>
                        setUtilityIncluded(
                          current,
                          category,
                          event.target.checked,
                        ),
                      )
                    }
                  />
                  Included in rent
                </label>
                <div className="utility-inclusion-source">
                  <span
                    className={`source source-${analysis.utilityIncludedSource[category]}`}
                  >
                    {analysis.utilityIncludedSource[category] === 'listing'
                      ? 'Inclusion from listing'
                      : analysis.utilityIncludedSource[category] === 'user'
                        ? 'Inclusion changed by user'
                        : 'Inclusion not confirmed'}
                  </span>
                  {analysis.utilityIncludedSource[category] === 'user' && (
                    <button
                      type="button"
                      className="reset"
                      onClick={() =>
                        update((current) => resetUtility(current, category))
                      }
                    >
                      Reset inclusion
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ReviewDisclosure>
      )}

      {!confirmed && (
        <ReviewDisclosure title="Property expenses">
          {(
            [
              ['parking', 'Parking'],
              ['laundry', 'Laundry'],
              ['petRent', 'Pet rent'],
              ['rentersInsurance', 'Renters insurance'],
              ['amenityFees', 'Amenity fees'],
              ['otherRequiredMonthlyFees', 'Other required fees'],
            ] as const
          ).map(([key, label]) => (
            <NumberField
              key={key}
              label={label}
              prefix="$"
              field={analysis.listing.recurring[key]}
              baseline={analysis.baseline.recurring[key]}
              onChange={(value) => recurring(key, value)}
              onReset={() => reset('recurring', key)}
            />
          ))}
          <label className="select-field">
            Laundry type
            <select
              value={analysis.laundryType}
              onChange={(event) =>
                update((current) => ({
                  ...current,
                  laundryType: event.target
                    .value as RentalAnalysis['laundryType'],
                }))
              }
            >
              <option value="in_unit">In-unit</option>
              <option value="shared_paid">Shared paid</option>
              <option value="shared_free">Shared free</option>
              <option value="hookups_only">Hookups only</option>
              <option value="none">None</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>
          {analysis.laundryType === 'shared_paid' && (
            <fieldset>
              <legend>Paid laundry estimate</legend>
              <div className="columns">
                {(['washPrice', 'dryPrice', 'loadsPerWeek'] as const).map(
                  (key) => (
                    <label key={key}>
                      {key === 'washPrice'
                        ? 'Wash price'
                        : key === 'dryPrice'
                          ? 'Dry price'
                          : 'Loads per week'}
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        value={analysis.paidLaundry[key]}
                        onChange={(event) =>
                          update((current) => ({
                            ...current,
                            paidLaundry: {
                              ...current.paidLaundry,
                              [key]: event.target.valueAsNumber || 0,
                            },
                          }))
                        }
                      />
                    </label>
                  ),
                )}
              </div>
            </fieldset>
          )}
          <FeeEditor
            title="Add custom recurring fee"
            fees={analysis.customRecurringFees}
            onChange={(fees) =>
              update((current) => ({ ...current, customRecurringFees: fees }))
            }
          />
        </ReviewDisclosure>
      )}

      {!confirmed && (
        <ReviewDisclosure title="Move-in costs">
          {(
            [
              ['applicationFee', 'Application fee'],
              ['securityDeposit', 'Security deposit'],
              ['firstMonthsRent', 'First month'],
              ['lastMonthsRent', 'Last month'],
              ['petDeposit', 'Pet deposit'],
              ['administrativeFee', 'Administrative fee'],
              ['utilityDeposits', 'Other deposits'],
              ['otherMoveInFees', 'Other fees'],
            ] as const
          ).map(([key, label]) => (
            <NumberField
              key={key}
              label={label}
              prefix="$"
              field={analysis.listing.upfront[key]}
              baseline={analysis.baseline.upfront[key]}
              onChange={(value) => upfront(key, value)}
              onReset={() => reset('upfront', key)}
            />
          ))}
          <FeeEditor
            title="Add custom one-time fee"
            fees={analysis.customOneTimeFees}
            onChange={(fees) =>
              update((current) => ({ ...current, customOneTimeFees: fees }))
            }
          />
        </ReviewDisclosure>
      )}

      {!confirmed && (
        <ReviewDisclosure title="Lease and concessions">
          <NumberField
            label="Lease duration (months)"
            min={1}
            field={analysis.listing.concessions?.leaseMonths}
            baseline={analysis.baseline.concessions?.leaseMonths}
            onChange={(value) => concession('leaseMonths', value)}
            onReset={() => reset('concessions', 'leaseMonths')}
          />
          <NumberField
            label="Free months"
            step={0.5}
            field={analysis.listing.concessions?.monthsFree}
            baseline={analysis.baseline.concessions?.monthsFree}
            onChange={(value) => concession('monthsFree', value)}
            onReset={() => reset('concessions', 'monthsFree')}
          />
          <NumberField
            label="One-time concession credit"
            prefix="$"
            field={analysis.listing.concessions?.oneTimeCredit}
            baseline={analysis.baseline.concessions?.oneTimeCredit}
            onChange={(value) => concession('oneTimeCredit', value)}
            onReset={() => reset('concessions', 'oneTimeCredit')}
          />
          <label className="select-field">
            Number of occupants
            <input
              type="number"
              min="1"
              step="1"
              value={analysis.occupants}
              onChange={(event) =>
                update((current) => ({
                  ...current,
                  occupants: event.target.valueAsNumber || 1,
                }))
              }
            />
            <span className="source source-user">Entered by user</span>
          </label>
        </ReviewDisclosure>
      )}

      {!confirmed && (
        <section className="confirm-panel" aria-labelledby="confirm-heading">
          <h2 id="confirm-heading">Ready to calculate?</h2>
          <p id="confirm-help">
            RentSight will calculate using the values above. Missing costs will
            remain clearly identified in the results.
          </p>
          <button
            type="button"
            className="primary-action confirm-action"
            disabled={!validation.valid}
            aria-describedby="confirm-help"
            onClick={() => setConfirmedRevision(analysis.updatedAt)}
          >
            Confirm
          </button>
        </section>
      )}

      {results && (
        <>
          <div className="results-actions">
            <button
              type="button"
              className="edit-review-action"
              onClick={() => setConfirmedRevision(undefined)}
            >
              Edit reviewed inputs
            </button>
          </div>
          <section className="results" aria-labelledby="results-heading">
            <h2 id="results-heading">Results</h2>
            <dl>
              <Result
                label="Advertised rent"
                value={listing.recurring.advertisedRent?.value}
              />
              <Result
                label="Estimated true monthly cost"
                value={results.monthly}
                featured
              />
              <Result label="Move-in cash required" value={results.moveIn} />
              <Result label="Refundable deposits" value={results.deposits} />
              <Result
                label="Nonrefundable move-in expenses"
                value={results.nonrefundable}
              />
              <Result label="First-year total" value={results.firstYear} />
              <Result
                label="Effective rent after concessions"
                value={results.effective}
              />
            </dl>
          </section>
          {results.missing.length > 0 && (
            <section className="warning" aria-labelledby="warning-heading">
              <h2 id="warning-heading">Missing or potentially overlooked</h2>
              <p>Confirm these items before relying on the estimate:</p>
              <ul>
                {results.missing.map((item) => (
                  <li key={`${item.cadence}-${item.category}`}>
                    <strong>{item.label}</strong> ({item.cadence})
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      <p className="save-state" role="status">
        Changes save automatically in this browser.
      </p>
    </main>
  );
}

function Result({
  label,
  value,
  featured = false,
}: {
  label: string;
  value?: number;
  featured?: boolean;
}) {
  return (
    <div className={featured ? 'featured' : undefined}>
      <dt>{label}</dt>
      <dd>{value === undefined ? 'Unknown' : MONEY.format(value)}</dd>
    </div>
  );
}
