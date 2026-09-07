import { accountSession, rentSightApi } from '../backend/services';
import { ExtractionSession } from '../ai/session';
import { canonicalizeListingUrl } from '../ai/identity';
import { applyAiExtraction, adaptExtraction } from '../ai/adapter';
import {
  AiExtractionCard,
  AiSourceReview,
  type AiControls,
} from './AiExtractionCard';
import { formatReviewIssue } from './reviewIssueLabels';
import {
  useEffect,
  useSyncExternalStore,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  calculateEffectiveMonthlyCostAfterConcessions,
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
  applyHouseholdProfile,
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
  type PropertyNote,
  type RentalAnalysis,
} from '../shared/analysis';
import { AiMark } from './AiMark';
import {
  DEFAULT_HOUSEHOLD_PROFILE,
  householdHasPets,
  normalizeHouseholdProfile,
  type HouseholdProfile,
} from '../shared/household';
import type { ExtensionResponse } from '../shared/messages';
import { isExtractionUpdatedMessage } from '../shared/messages';
import {
  clearAllRentSightData,
  extensionStorage,
  getRentalAnalysis,
  persistSavedListings,
  setRentalAnalysis,
} from '../storage';
import { NumberField, TextField } from './Fields';
import {
  createComparison,
  comparisonBest,
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
import { MembershipBadge } from './MembershipBadge';
import {
  preserveReadyViewAfterInspectionFailure,
  refreshReadyView,
  type ViewState,
} from './lifecycle';

const EMPTY_INSPECTION_MESSAGE =
  'Open a rental listing, then click the RentSight toolbar icon to inspect it.';

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

function DefaultedNumberInput({
  value,
  defaultValue,
  min = 0,
  step = 1,
  onCommit,
  ...props
}: Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'defaultValue' | 'min' | 'step' | 'onChange' | 'onBlur'
> & {
  value: number;
  defaultValue: number;
  min?: number;
  step?: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);

  const commit = () => {
    focused.current = false;
    const parsed = draft === '' ? defaultValue : Number(draft);
    const next = Number.isFinite(parsed) ? Math.max(min, parsed) : defaultValue;
    setDraft(String(next));
    onCommit(next);
  };

  return (
    <input
      {...props}
      type="number"
      min={min}
      step={step}
      value={draft}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
    />
  );
}

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
            <DefaultedNumberInput
              value={fee.amount}
              defaultValue={0}
              onCommit={(value) =>
                onChange(
                  fees.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, amount: value } : item,
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
  const clearingDataRef = useRef(false);
  const account = useSyncExternalStore(
    accountSession.subscribe,
    accountSession.getSnapshot,
    accountSession.getSnapshot,
  );
  const [aiSession] = useState(
    () =>
      new ExtractionSession(
        rentSightApi,
        (response) => {
          setView((current) =>
            current.status === 'ready' &&
            canonicalizeListingUrl(current.url) ===
              canonicalizeListingUrl(response.identity.listingUrl)
              ? {
                  ...current,
                  analysis: applyHouseholdProfile(
                    applyAiExtraction(current.analysis, response),
                    current.householdProfile,
                  ),
                }
              : current,
          );
        },
        async () => {
          const response: ExtensionResponse = await chrome.runtime.sendMessage({
            type: 'GET_AI_CAPTURE',
          });
          if (
            response.type !== 'PAGE_INFO_RESPONSE' ||
            !response.payload.aiCapture
          )
            throw new Error();
          return response.payload;
        },
      ),
  );
  const aiState = useSyncExternalStore(
    aiSession.subscribe,
    aiSession.getSnapshot,
    aiSession.getSnapshot,
  );
  const aiPage = view.status === 'ready' ? view.aiPage : undefined;
  const accountId = account.user?.uid;
  const accountStatus = account.status;
  useEffect(() => {
    if (accountStatus !== 'plus' || !aiPage || aiPage.aiCapture) return;
    let active = true;
    aiSession.prepareCapture();
    // Local extraction is already displayed. Capture and backend work are optional.
    void chrome.runtime
      .sendMessage({ type: 'GET_AI_CAPTURE' })
      .then((response: ExtensionResponse) => {
        if (!active) return;
        if (
          response.type !== 'PAGE_INFO_RESPONSE' ||
          !response.payload.aiCapture
        ) {
          aiSession.captureFailed();
          return;
        }
        if (
          response.payload.url !== aiPage.url ||
          response.payload.selectedUnitId !== aiPage.selectedUnitId
        )
          return;
        setView((current) =>
          current.status === 'ready' && current.aiPage === aiPage
            ? {
                ...current,
                aiPage: { ...aiPage, aiCapture: response.payload.aiCapture },
              }
            : current,
        );
      })
      .catch(() => {
        if (active) aiSession.captureFailed();
      });
    return () => {
      active = false;
    };
  }, [accountStatus, aiPage, aiSession]);

  useEffect(() => {
    if (accountStatus === 'plus' && accountId && aiPage?.aiCapture)
      aiSession.activate(aiPage, accountId);
    else if (accountStatus !== 'plus' || !aiPage) aiSession.invalidate();
  }, [aiSession, aiPage, accountStatus, accountId]);
  useEffect(() => () => aiSession.dispose(), [aiSession]);
  const aiControls: AiControls = {
    state: aiState,
    retry: () => aiSession.retry(),
    continueWithPreliminary: () => aiSession.continueWithPreliminary(),
  };

  useEffect(() => {
    let active = true;
    async function load(): Promise<void> {
      try {
        const response = (await chrome.runtime.sendMessage({
          type: 'GET_PAGE_INFO',
        })) as ExtensionResponse;
        if (!active) return;
        if (response.type === 'EXTENSION_ERROR') {
          setView((current) =>
            preserveReadyViewAfterInspectionFailure(
              current,
              EMPTY_INSPECTION_MESSAGE,
            ),
          );
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
        const [
          saved,
          storedRecords,
          storedInternetCost,
          storedHouseholdProfile,
          onboardingCompleted,
        ] = await Promise.all([
          getRentalAnalysis(response.payload.url),
          extensionStorage.get('savedListings'),
          extensionStorage.get('internetMonthlyCost'),
          extensionStorage.get('householdProfile'),
          extensionStorage.get('onboardingCompleted'),
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
        const householdProfile = normalizeHouseholdProfile(
          storedHouseholdProfile ?? {
            occupants: analysis.occupants,
            internetMonthlyCost: internetCost,
          },
        );
        analysis = applyHouseholdProfile(analysis, householdProfile);
        if (storedHouseholdProfile === undefined)
          await extensionStorage.set('householdProfile', householdProfile);
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
            aiPage: response.payload,
            analysis,
            savedListings,
            onboardingCompleted: onboardingCompleted === true,
            householdProfile,
          });
      } catch (error: unknown) {
        if (!active) return;
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to load this listing.';
        console.error('[RentSight] Side panel initialization failed', error);
        setView((current) =>
          preserveReadyViewAfterInspectionFailure(current, message),
        );
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
          aiSession.invalidate();
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
            extensionStorage.get('householdProfile'),
          ]).then(([stored, storedProfile]) => {
            if (!active || revision !== navigationRevision) return;
            setView((current) =>
              current.status === 'ready'
                ? {
                    ...current,
                    url: message.payload.url,
                    aiPage: message.payload,
                    analysis: applyHouseholdProfile(
                      analysisForNavigation(
                        current.analysis,
                        message.payload.url,
                        message.payload.title,
                        message.payload.extraction,
                        stored ? { [message.payload.url]: stored } : undefined,
                      ),
                      normalizeHouseholdProfile(storedProfile),
                    ),
                  }
                : current,
            );
          });
        });
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => {
      active = false;
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [aiSession]);

  useEffect(() => {
    if (view.status !== 'ready') return;
    const timeout = window.setTimeout(() => {
      if (clearingDataRef.current) return;
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

  const updateHouseholdProfile = (profile: HouseholdProfile) => {
    const normalized = normalizeHouseholdProfile(profile);
    void extensionStorage
      .set('householdProfile', normalized)
      .catch((error) =>
        console.error('[RentSight] Could not save household profile', error),
      );
    setView((current) =>
      current.status === 'ready'
        ? {
            ...current,
            householdProfile: normalized,
            analysis: applyHouseholdProfile(current.analysis, normalized),
          }
        : current,
    );
  };

  const refreshCurrent = async (): Promise<void> => {
    aiSession.invalidate();
    const response = (await chrome.runtime.sendMessage({
      type: 'GET_AI_CAPTURE',
    })) as ExtensionResponse;
    if (response.type === 'EXTENSION_ERROR') throw new Error(response.error);
    if (response.payload.requiresUnitSelection)
      throw new Error('Select a specific unit, then refresh again.');
    if (!response.payload.appearsToBeRentalListing)
      throw new Error('The active page does not look like a rental listing.');

    const stored = await getRentalAnalysis(response.payload.url);
    setView((current) => {
      if (current.status !== 'ready') return current;
      return refreshReadyView(
        current,
        response.payload,
        stored ? { [response.payload.url]: stored } : undefined,
      );
    });
    if (accountStatus === 'plus' && response.payload.aiCapture)
      aiSession.refresh(response.payload);
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

  const clearAllData = async () => {
    clearingDataRef.current = true;
    aiSession.invalidate();
    try {
      await clearAllRentSightData();
      setView({ status: 'data-cleared' });
    } catch (error: unknown) {
      clearingDataRef.current = false;
      throw error;
    }
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
      <UnavailableWorkspace
        clearAllData={clearAllData}
        refreshCurrent={() => window.location.reload()}
      >
        <main>
          <p className="status error">{view.message}</p>
        </main>
      </UnavailableWorkspace>
    );
  }
  if (view.status === 'data-cleared') {
    return (
      <main className="data-cleared">
        <span className="eyebrow">Local data removed</span>
        <h1>RentSight has been reset</h1>
        <p>
          Drafts, saved listings, preferences, and cached estimates were deleted
          from this Chrome profile.
        </p>
        <button
          type="button"
          className="primary-action"
          onClick={() => window.location.reload()}
        >
          Start again
        </button>
      </main>
    );
  }
  if (view.status === 'unit-selection-required') {
    return (
      <UnavailableWorkspace
        clearAllData={clearAllData}
        refreshCurrent={() => window.location.reload()}
      >
        <main>
          <section className="warning">
            <h1>Select a unit first</h1>
            <p>
              Community pages can contain many units with different rents,
              dimensions, fees, and availability. Open a specific unit before
              using the Current view.
            </p>
          </section>
        </main>
      </UnavailableWorkspace>
    );
  }
  if (view.status === 'unsupported') {
    const openManualEntry = async () => {
      try {
        const [
          storedAnalysis,
          storedRecords,
          internetCost,
          storedHouseholdProfile,
          onboardingCompleted,
        ] = await Promise.all([
          getRentalAnalysis(view.url),
          extensionStorage.get('savedListings'),
          extensionStorage.get('internetMonthlyCost'),
          extensionStorage.get('householdProfile'),
          extensionStorage.get('onboardingCompleted'),
        ]);
        const householdProfile = normalizeHouseholdProfile(
          storedHouseholdProfile ?? { internetMonthlyCost: internetCost },
        );
        setView({
          status: 'ready',
          url: view.url,
          analysis: applyHouseholdProfile(
            storedAnalysis ?? createInitialAnalysis(view.url, view.title),
            householdProfile,
          ),
          savedListings: migrateSavedRecords(storedRecords),
          onboardingCompleted: onboardingCompleted === true,
          householdProfile,
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
      <UnavailableWorkspace
        clearAllData={clearAllData}
        refreshCurrent={() => window.location.reload()}
      >
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
      </UnavailableWorkspace>
    );
  }

  return (
    <Workspace
      aiControls={aiControls}
      analysis={view.analysis}
      savedListings={view.savedListings}
      update={update}
      setSavedListings={setSavedListings}
      onboardingCompleted={view.onboardingCompleted}
      householdProfile={view.householdProfile}
      updateHouseholdProfile={updateHouseholdProfile}
      refreshCurrent={refreshCurrent}
      clearAllData={clearAllData}
    />
  );
}

type WorkspaceTab = 'current' | 'saved' | 'compare' | 'about';

export function UnavailableWorkspace({
  children,
  clearAllData,
  refreshCurrent,
}: {
  children: ReactNode;
  clearAllData: () => Promise<void>;
  refreshCurrent: () => void;
}) {
  const [tab, setTab] = useState<WorkspaceTab>('current');
  const [savedListings, setSavedListings] = useState<SavedListingRecord[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [householdProfile, setHouseholdProfile] = useState<HouseholdProfile>({
    ...DEFAULT_HOUSEHOLD_PROFILE,
  });

  useEffect(() => {
    let active = true;
    void extensionStorage
      .get('savedListings')
      .then((records) => {
        if (active) setSavedListings(migrateSavedRecords(records));
      })
      .catch((error: unknown) => {
        if (active)
          setNotice(
            error instanceof Error
              ? error.message
              : 'Could not load saved listings.',
          );
      });
    void extensionStorage
      .get('householdProfile')
      .then((profile) => {
        if (active) setHouseholdProfile(normalizeHouseholdProfile(profile));
      })
      .catch((error: unknown) => {
        if (active)
          setNotice(
            error instanceof Error
              ? error.message
              : 'Could not load the household profile.',
          );
      });
    return () => {
      active = false;
    };
  }, []);

  const setRecords = async (records: SavedListingRecord[]) => {
    await persistSavedListings(records);
    setSavedListings(records);
  };

  return (
    <>
      <MembershipBadge />
      <nav className="workspace-tabs" aria-label="RentSight views">
        {(['current', 'saved', 'compare', 'about'] as const).map((item) => (
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
                : item === 'compare'
                  ? `Compare (${selected.length})`
                  : 'About'}
          </button>
        ))}
      </nav>
      {tab === 'current' && (
        <div className="current-actions">
          <RefreshListingButton onClick={refreshCurrent} />
        </div>
      )}
      {notice && (
        <p className="workspace-notice" role="status">
          {notice}
        </p>
      )}
      {tab === 'current' && children}
      {tab === 'saved' && (
        <SavedListingsView
          records={savedListings}
          selected={selected}
          setSelected={setSelected}
          setRecords={setRecords}
          setNotice={setNotice}
          onDelete={async (record) => {
            await setRecords(deleteListing(savedListings, record.id));
            setSelected((current) => current.filter((id) => id !== record.id));
            setNotice('Saved listing deleted.');
          }}
          openCompare={() => setTab('compare')}
        />
      )}
      {tab === 'compare' && (
        <ComparisonView
          records={savedListings.filter((record) =>
            selected.includes(record.id),
          )}
          householdProfile={householdProfile}
        />
      )}
      {tab === 'about' && (
        <AboutPrivacy
          clearAllData={clearAllData}
          replayTour={() => {
            setTab('current');
            setNotice('Open a rental listing to replay the guided tour.');
          }}
        />
      )}
    </>
  );
}

function Workspace({
  aiControls,
  analysis,
  savedListings,
  update,
  setSavedListings,
  clearAllData,
  onboardingCompleted,
  householdProfile,
  updateHouseholdProfile,
  refreshCurrent,
}: {
  aiControls: AiControls;
  analysis: RentalAnalysis;
  savedListings: SavedListingRecord[];
  update: (transform: (analysis: RentalAnalysis) => RentalAnalysis) => void;
  setSavedListings: (records: SavedListingRecord[]) => Promise<void>;
  clearAllData: () => Promise<void>;
  onboardingCompleted: boolean;
  householdProfile: HouseholdProfile;
  updateHouseholdProfile: (profile: HouseholdProfile) => void;
  refreshCurrent: () => Promise<void>;
}) {
  const [tab, setTab] = useState<WorkspaceTab>('current');
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [tourStep, setTourStep] = useState<number | undefined>(
    onboardingCompleted ? undefined : 0,
  );
  const [deletedRecord, setDeletedRecord] = useState<{
    record: SavedListingRecord;
    index: number;
  }>();
  const currentUrl = analysis.listing.identity.url?.value;
  const currentSaved = savedListings.find(
    (record) => record.url === currentUrl,
  );

  useEffect(() => {
    if (notice !== 'Listing saved.') return;
    const timeout = window.setTimeout(() => setNotice(''), 3500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const startTour = () => {
    setTab('current');
    setTourStep(0);
  };

  const refresh = async () => {
    setRefreshing(true);
    setNotice('');
    try {
      await refreshCurrent();
      setNotice('Current listing refreshed.');
    } catch (error: unknown) {
      setNotice(
        error instanceof Error ? error.message : 'Could not refresh listing.',
      );
    } finally {
      setRefreshing(false);
    }
  };

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

  const removeSavedListing = async (record: SavedListingRecord) => {
    const index = savedListings.findIndex((item) => item.id === record.id);
    await setSavedListings(deleteListing(savedListings, record.id));
    setSelected((current) => current.filter((id) => id !== record.id));
    setDeletedRecord({ record, index });
    setNotice('Saved listing deleted.');
  };

  const undoDelete = async () => {
    if (!deletedRecord) return;
    try {
      const restored = [...savedListings];
      restored.splice(deletedRecord.index, 0, deletedRecord.record);
      await setSavedListings(restored);
      setDeletedRecord(undefined);
      setNotice('Saved listing restored.');
    } catch (error: unknown) {
      setNotice(
        error instanceof Error ? error.message : 'Could not restore listing.',
      );
    }
  };

  return (
    <>
      <MembershipBadge />
      <nav
        className={`workspace-tabs${tourStep !== undefined ? ' tour-active' : ''}`}
        aria-label="RentSight views"
      >
        {(['current', 'saved', 'compare', 'about'] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-current={tab === item ? 'page' : undefined}
            className={
              tourStep !== undefined && tab === item
                ? 'tour-highlight'
                : undefined
            }
            onClick={() => setTab(item)}
          >
            {item === 'current'
              ? 'Current'
              : item === 'saved'
                ? `Saved (${savedListings.length})`
                : item === 'compare'
                  ? `Compare (${selected.length})`
                  : 'About'}
          </button>
        ))}
      </nav>
      {tab === 'current' && (
        <div className="current-actions">
          <RefreshListingButton
            refreshing={refreshing}
            onClick={() => void refresh()}
          />
        </div>
      )}
      {notice && (
        <p className="workspace-notice" role="status">
          {notice}
          {deletedRecord && notice === 'Saved listing deleted.' && (
            <button type="button" onClick={() => void undoDelete()}>
              Undo
            </button>
          )}
        </p>
      )}
      {tab === 'current' && (
        <AnalysisEditor
          aiControls={aiControls}
          analysis={analysis}
          update={update}
          householdProfile={householdProfile}
          updateHouseholdProfile={updateHouseholdProfile}
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
          onDelete={removeSavedListing}
          openCompare={() => setTab('compare')}
        />
      )}
      {tab === 'compare' && (
        <ComparisonView
          records={savedListings.filter((record) =>
            selected.includes(record.id),
          )}
          householdProfile={householdProfile}
        />
      )}
      {tab === 'about' && (
        <AboutPrivacy clearAllData={clearAllData} replayTour={startTour} />
      )}
      {tourStep !== undefined && (
        <GuidedTour
          step={tourStep}
          setStep={(nextStep) => {
            setTourStep(nextStep);
            setTab(TOUR_STEPS[nextStep].tab);
          }}
          finish={async () => {
            await extensionStorage.set('onboardingCompleted', true);
            setTourStep(undefined);
          }}
          householdProfile={householdProfile}
          updateHouseholdProfile={updateHouseholdProfile}
        />
      )}
    </>
  );
}

function RefreshListingButton({
  refreshing = false,
  onClick,
}: {
  refreshing?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="refresh-listing"
      disabled={refreshing}
      onClick={onClick}
    >
      <span aria-hidden="true">↻</span>{' '}
      {refreshing ? 'Refreshing…' : 'Refresh listing'}
    </button>
  );
}

const TOUR_STEPS: readonly {
  tab: WorkspaceTab;
  title: string;
  description: string;
  profile?: boolean;
}[] = [
  {
    tab: 'current',
    title: 'Review the current listing',
    description:
      'Check the details RentSight found, correct any assumptions, and confirm the inputs to see the estimated costs for a listing.',
  },
  {
    tab: 'saved',
    title: 'Build your shortlist',
    description:
      'Save promising listings here so you can return to them later.',
  },
  {
    tab: 'compare',
    title: 'Compare total costs',
    description:
      'Select at least two saved listings to compare rent, recurring expenses, move-in cash, and data completeness side by side.',
  },
  {
    tab: 'about',
    title: 'Privacy and controls',
    description:
      'Learn how RentSight keeps data local, replay this tour, send feedback, or delete all stored RentSight data.',
  },
  {
    tab: 'current',
    title: 'Personalize your estimates',
    description:
      'Optional: save a few household details so RentSight can apply relevant utilities and pet costs to every property.',
    profile: true,
  },
];

export function GuidedTour({
  step,
  setStep,
  finish,
  householdProfile = { ...DEFAULT_HOUSEHOLD_PROFILE },
  updateHouseholdProfile = () => undefined,
}: {
  step: number;
  setStep: (step: number) => void;
  finish: () => Promise<void>;
  householdProfile?: HouseholdProfile;
  updateHouseholdProfile?: (profile: HouseholdProfile) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const finishRef = useRef(finish);
  const [finishError, setFinishError] = useState('');
  const current = TOUR_STEPS[step];

  useEffect(() => {
    finishRef.current = finish;
  }, [finish]);

  const complete = async () => {
    try {
      await finish();
    } catch (error: unknown) {
      setFinishError(
        error instanceof Error ? error.message : 'Could not save tour status.',
      );
    }
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusable = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled)'));
    focusable()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        void finishRef
          .current()
          .catch((error: unknown) =>
            setFinishError(
              error instanceof Error
                ? error.message
                : 'Could not save tour status.',
            ),
          );
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = focusable();
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [step]);

  return (
    <div className="tour-layer">
      <div className="tour-overlay" aria-hidden="true" />
      <div
        className="tour-dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-description"
      >
        <span className="eyebrow">
          Quick tour · {step + 1} of {TOUR_STEPS.length}
        </span>
        <h2 id="tour-title">{current.title}</h2>
        <p id="tour-description">{current.description}</p>
        {current.profile && (
          <HouseholdProfileFields
            profile={householdProfile}
            onChange={updateHouseholdProfile}
            compact
          />
        )}
        {finishError && (
          <p className="tour-error" role="alert">
            {finishError}
          </p>
        )}
        <div className="tour-actions">
          <button
            type="button"
            className="tour-skip"
            onClick={() => void complete()}
          >
            Skip tour
          </button>
          <div>
            <button
              type="button"
              disabled={step === 0}
              onClick={() => setStep(step - 1)}
            >
              Back
            </button>
            {step === TOUR_STEPS.length - 1 ? (
              <button
                type="button"
                className="primary-action"
                onClick={() => void complete()}
              >
                Start using RentSight
              </button>
            ) : (
              <button
                type="button"
                className="primary-action"
                onClick={() => setStep(step + 1)}
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AboutPrivacy({
  clearAllData,
  replayTour,
}: {
  clearAllData: () => Promise<void>;
  replayTour: () => void;
}) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearError, setClearError] = useState('');
  const version =
    typeof chrome !== 'undefined' && chrome.runtime?.getManifest
      ? chrome.runtime.getManifest().version
      : '0.1.0';

  const clear = async () => {
    try {
      await clearAllData();
    } catch (error: unknown) {
      setConfirmClear(false);
      setClearError(
        error instanceof Error ? error.message : 'Could not delete local data.',
      );
    }
  };

  return (
    <main className="about-privacy">
      <header>
        <span className="eyebrow">RentSight {version}</span>
        <h1>About &amp; Privacy</h1>
        <p>
          RentSight helps you review the estimated total cost of rental
          listings. Estimates are informational, not quotes or financial advice.
        </p>
      </header>

      <section aria-labelledby="privacy-heading">
        <h2 id="privacy-heading">Listing data and AI review</h2>
        <p>
          Drafts, customer edits, saved listings, and estimates are stored in
          this Chrome profile. For signed-in RentSight+ accounts, AI review
          automatically sends captured listing text, structured listing data,
          the listing URL, selected unit, and preliminary values to RentSight’s
          backend and OpenAI. Customer overrides and household financial
          assumptions are not included in extraction requests. Full page
          captures are not saved locally. RentSight also contacts its backend
          for account and billing services.
        </p>
        <p>
          RentSight inspects only the active page after you click its toolbar
          icon. JSON and CSV exports may contain property addresses and your
          financial assumptions, so store and share them carefully.
        </p>
        <a href="privacy.html" target="_blank" rel="noreferrer">
          Read the full privacy policy
        </a>
        <a
          href="https://github.com/dowen752/rentsight-extension/issues"
          target="_blank"
          rel="noreferrer"
        >
          Report a problem or share feedback
        </a>
      </section>

      <section className="data-controls" aria-labelledby="data-heading">
        <h2 id="data-heading">Manage local data</h2>
        <p>
          Delete every RentSight draft, saved listing, preference, and cached
          estimate from this Chrome profile. Export saved listings first if you
          want a backup.
        </p>
        {clearError && (
          <p className="status error" role="alert">
            {clearError}
          </p>
        )}
        {confirmClear ? (
          <div className="clear-confirmation">
            <p>
              <strong>Delete all local RentSight data?</strong>
            </p>
            <p>This cannot be undone.</p>
            <button
              type="button"
              className="remove"
              onClick={() => void clear()}
            >
              Delete all data
            </button>
            <button type="button" onClick={() => setConfirmClear(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="remove"
            onClick={() => setConfirmClear(true)}
          >
            Delete all local data
          </button>
        )}
      </section>
      <section aria-labelledby="help-heading">
        <h2 id="help-heading">Need a refresher?</h2>
        <p>Walk through the four main RentSight views again.</p>
        <button type="button" className="replay-tour" onClick={replayTour}>
          Replay guided tour
        </button>
      </section>
    </main>
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
  onDelete,
  openCompare,
}: {
  records: SavedListingRecord[];
  selected: string[];
  setSelected: (ids: string[]) => void;
  setRecords: (records: SavedListingRecord[]) => Promise<void>;
  setNotice: (notice: string) => void;
  onDelete: (record: SavedListingRecord) => Promise<void>;
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
          Compare Selected
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
        <button
          type="button"
          disabled={records.length === 0 || selected.length === records.length}
          onClick={() => setSelected(records.map((record) => record.id))}
        >
          Select all
        </button>
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
                      await onDelete(record);
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
  'lower' | 'higher',
][] = [
  ['Advertised rent', 'advertisedRent', 'money', 'lower'],
  ['True monthly cost', 'trueMonthlyCost', 'money', 'lower'],
  ['Move-in cash', 'moveInCash', 'money', 'lower'],
  ['First-year total', 'firstYearTotal', 'money', 'lower'],
  ['Bedrooms', 'bedrooms', 'number', 'higher'],
  ['Bathrooms', 'bathrooms', 'number', 'higher'],
  ['Square feet', 'squareFootage', 'number', 'higher'],
  ['Utilities', 'utilities', 'money', 'lower'],
  ['Pet expenses', 'petExpenses', 'money', 'lower'],
];

function comparableValue(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (
    typeof value === 'object' &&
    value &&
    'score' in value &&
    typeof value.score === 'number'
  )
    return value.score;
  return undefined;
}

function ComparisonView({
  records,
  householdProfile,
}: {
  records: SavedListingRecord[];
  householdProfile: HouseholdProfile;
}) {
  const items = records.map(createComparison);
  const rows = householdHasPets(householdProfile)
    ? comparisonRows
    : comparisonRows.filter(([, key]) => key !== 'petExpenses');
  const comparisonScrollRef = useRef<HTMLDivElement>(null);
  const [comparisonOverflows, setComparisonOverflows] = useState(false);

  useEffect(() => {
    const scrollContainer = comparisonScrollRef.current;
    if (!scrollContainer || items.length < 2) return;

    const updateOverflow = () => {
      setComparisonOverflows(
        scrollContainer.scrollWidth > scrollContainer.clientWidth + 1,
      );
    };

    updateOverflow();
    const resizeObserver = new ResizeObserver(updateOverflow);
    resizeObserver.observe(scrollContainer);
    const table = scrollContainer.querySelector('table');
    if (table) resizeObserver.observe(table);

    return () => resizeObserver.disconnect();
  }, [items.length]);

  return (
    <main className="comparison-page">
      <header>
        <span className="eyebrow">Side-by-side</span>
        <h1>Compare listings</h1>
        <p>
          Compare known listing costs and features side by side. It is not a
          financial recommendation.
        </p>
      </header>
      {items.length < 2 ? (
        <section>
          <h2>Select at least two listings</h2>
          <p>Use the Saved view to choose listings for comparison.</p>
        </section>
      ) : (
        <>
          {comparisonOverflows && (
            <p
              className="comparison-overflow-hint"
              id="comparison-overflow-hint"
              role="status"
            >
              <span aria-hidden="true">↔</span>
              Widen the panel or scroll sideways to see all listings
            </p>
          )}
          <div
            className="comparison-scroll"
            ref={comparisonScrollRef}
            tabIndex={0}
            aria-label="Listing comparison table"
            aria-describedby={
              comparisonOverflows ? 'comparison-overflow-hint' : undefined
            }
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Metric</th>
                  {items.map((item) => (
                    <th scope="col" key={item.id}>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        title={item.address}
                        aria-label={`Open ${item.address} listing`}
                      >
                        <span>{item.address}</span>
                      </a>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(([label, key, format, direction]) => {
                  const values = items.map((item) =>
                    comparableValue(item[key]),
                  );
                  const best = comparisonBest(values, direction);
                  return (
                    <tr key={key}>
                      <th scope="row">{label}</th>
                      {items.map((item, index) => {
                        const value = item[key];
                        const comparable = values[index];
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
                        const isBest =
                          best !== undefined && comparable === best;
                        return (
                          <td
                            className={isBest ? 'comparison-best' : undefined}
                            key={item.id}
                            aria-label={
                              isBest ? `${display}, favorable value` : undefined
                            }
                          >
                            {display}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                <tr className="comparison-notes-row">
                  <th scope="row">
                    Other details
                    <small>
                      Features and details outside the cost calculation
                    </small>
                  </th>
                  {items.map((item) => (
                    <td key={item.id}>
                      {item.notes.length ? (
                        <ul>
                          {item.notes.map((note) => (
                            <li key={note.id}>
                              {note.source === 'ai' && <AiMark />}
                              <span>{note.text}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="comparison-no-notes">No notes</span>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}

interface AnalysisEditorProps {
  aiControls?: AiControls;
  analysis: RentalAnalysis;
  update: (transform: (analysis: RentalAnalysis) => RentalAnalysis) => void;
  toolbar?: ReactNode;
  householdProfile?: HouseholdProfile;
  updateHouseholdProfile?: (profile: HouseholdProfile) => void;
}

function HouseholdProfileFields({
  profile,
  onChange,
  compact = false,
}: {
  profile: HouseholdProfile;
  onChange: (profile: HouseholdProfile) => void;
  compact?: boolean;
}) {
  return (
    <div className={`household-fields${compact ? ' compact' : ''}`}>
      <label>
        Occupants
        <DefaultedNumberInput
          value={profile.occupants}
          defaultValue={1}
          min={1}
          onCommit={(value) => onChange({ ...profile, occupants: value })}
        />
      </label>
      <label>
        Internet / month
        <span className="input-row">
          <span className="prefix">$</span>
          <input
            type="number"
            min="0"
            placeholder="Not included"
            value={profile.internetMonthlyCost ?? ''}
            onChange={(event) =>
              onChange({
                ...profile,
                internetMonthlyCost: Number.isNaN(event.target.valueAsNumber)
                  ? undefined
                  : Math.max(0, event.target.valueAsNumber),
              })
            }
          />
        </span>
      </label>
      <label className="pet-presence">
        <input
          type="checkbox"
          checked={profile.smallDogs > 0}
          onChange={(event) =>
            onChange({ ...profile, smallDogs: event.target.checked ? 1 : 0 })
          }
        />
        Small dog
      </label>
      <label className="pet-presence">
        <input
          type="checkbox"
          checked={profile.largeDogs > 0}
          onChange={(event) =>
            onChange({ ...profile, largeDogs: event.target.checked ? 1 : 0 })
          }
        />
        Large dog
      </label>
      <label className="pet-presence">
        <input
          type="checkbox"
          checked={profile.otherPets}
          onChange={(event) =>
            onChange({ ...profile, otherPets: event.target.checked })
          }
        />
        Other pet
      </label>
    </div>
  );
}

function householdSummary(profile: HouseholdProfile): string {
  const details = [
    `${profile.occupants} occupant${profile.occupants === 1 ? '' : 's'}`,
  ];
  if (profile.smallDogs) details.push('small dog');
  if (profile.largeDogs) details.push('large dog');
  if (profile.otherPets) details.push('other pet');
  if (!householdHasPets(profile)) details.push('no pets');
  details.push(
    profile.internetMonthlyCost === undefined
      ? 'internet not included'
      : `${MONEY.format(profile.internetMonthlyCost)}/mo internet`,
  );
  return details.join(' · ');
}

function HouseholdProfileCard({
  profile,
  onChange,
}: {
  profile: HouseholdProfile;
  onChange: (profile: HouseholdProfile) => void;
}) {
  return (
    <details className="household-card">
      <summary>
        <span>
          <strong>Your household</strong>
          <small>{householdSummary(profile)}</small>
        </span>
        <span className="household-edit">Edit</span>
      </summary>
      <div className="household-card-content">
        <HouseholdProfileFields profile={profile} onChange={onChange} />
        <p>Saved locally and reused for every property.</p>
      </div>
    </details>
  );
}

function PropertyNotesEditor({
  notes,
  onAdd,
  onRemove,
}: {
  notes: PropertyNote[];
  onAdd: (text: string) => void;
  onRemove: (id: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    onAdd(text);
    setDraft('');
  };
  return (
    <ReviewDisclosure title="Other details">
      <div className="property-notes-editor">
        <p>
          Keep features, restrictions, and listing details that don’t affect the
          cost calculation.
        </p>
        {notes.length > 0 && (
          <ul>
            {notes.map((note) => (
              <li key={note.id}>
                {note.source === 'ai' && <AiMark />}
                <span>{note.text}</span>
                <button
                  type="button"
                  className="remove-note"
                  onClick={() => onRemove(note.id)}
                  aria-label={`Remove note: ${note.text}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="property-note-entry">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="e.g. Wi-Fi included"
            aria-label="New property detail"
            maxLength={240}
          />
          <button type="button" onClick={submit} disabled={!draft.trim()}>
            Add detail
          </button>
        </div>
      </div>
    </ReviewDisclosure>
  );
}

export function AnalysisEditor({
  aiControls,
  analysis,
  update: updateAnalysis,
  toolbar,
  householdProfile = normalizeHouseholdProfile(analysis.householdProfile),
  updateHouseholdProfile = () => undefined,
}: AnalysisEditorProps) {
  const [confirmedRevision, setConfirmedRevision] = useState<
    string | undefined
  >();
  const aiBlocked =
    aiControls?.state.status === 'preparing' ||
    aiControls?.state.status === 'extracting' ||
    (aiControls?.state.status === 'failed' && !aiControls.state.continued);
  const unresolvedCharges = analysis.aiExtraction
    ? adaptExtraction(analysis.aiExtraction).manualCharges.some(
        (charge) => !analysis.aiReviewDecisions?.[charge.id],
      )
    : false;
  const confirmationKey = `${analysis.updatedAt}:${aiControls && 'requestId' in aiControls.state ? aiControls.state.requestId : ''}`;
  const confirmed =
    !aiBlocked && !unresolvedCharges && confirmedRevision === confirmationKey;
  const listing = useMemo(() => materializeListing(analysis), [analysis]);
  const validation = useMemo(() => validateRentalListing(listing), [listing]);
  const reviewIssues = analysis.aiExtraction?.result.reviewIssues ?? [];
  const extractionWarnings = analysis.extraction?.warnings ?? [];
  const reviewMessagesAreWarningSuffix = reviewIssues.every(
    (issue, index) =>
      extractionWarnings[
        extractionWarnings.length - reviewIssues.length + index
      ] === issue.message,
  );
  const standaloneExtractionWarnings = reviewMessagesAreWarningSuffix
    ? extractionWarnings.slice(
        0,
        extractionWarnings.length - reviewIssues.length,
      )
    : extractionWarnings;
  const results = useMemo(() => {
    if (!confirmed || !validation.valid) return undefined;
    return {
      monthly: calculateEstimatedTrueMonthlyCost(listing),
      moveIn: calculateRequiredMoveInCash(listing),
      deposits: calculateRefundableDeposits(listing),
      nonrefundable: calculateNonrefundableMoveInExpenses(listing),
      firstYear: calculateFirstYearHousingCost(listing),
      effective: calculateEffectiveMonthlyRent(listing),
      effectiveMonthlyCost:
        calculateEffectiveMonthlyCostAfterConcessions(listing),
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

  const addPropertyNote = (text: string) =>
    update((current) => ({
      ...current,
      propertyNotes: [
        ...(current.propertyNotes ?? []),
        {
          id: crypto.randomUUID(),
          text,
          source: 'user',
        } satisfies PropertyNote,
      ],
      updatedAt: new Date().toISOString(),
    }));

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
      {aiControls && <AiExtractionCard controls={aiControls} />}
      {!confirmed && <AiSourceReview analysis={analysis} update={update} />}
      {confirmed && toolbar && (
        <div className="analysis-toolbar">{toolbar}</div>
      )}

      {analysis.extraction?.petPolicy === 'none' &&
        householdHasPets(householdProfile) && (
          <section
            className="warning pet-policy-warning"
            aria-labelledby="pet-policy-heading"
          >
            <h2 id="pet-policy-heading">Pet policy conflict</h2>
            <p>
              This listing says pets are not allowed, but your household profile
              includes a pet. Confirm the policy with the property before
              applying.
            </p>
            {analysis.extraction.rawPetPolicyText && (
              <span className="source source-listing">
                Listing text: {analysis.extraction.rawPetPolicyText}
              </span>
            )}
          </section>
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

      {!confirmed &&
      (standaloneExtractionWarnings.length > 0 || reviewIssues.length > 0) ? (
        <section className="warning" aria-labelledby="extraction-heading">
          <h2 id="extraction-heading">Extraction needs review</h2>
          <ul>
            {standaloneExtractionWarnings.map((warning, index) => (
              <li key={`extraction-warning:${index}:${warning}`}>{warning}</li>
            ))}
            {reviewIssues.map((issue) => (
              <li key={`review-issue:${issue.id}`}>
                {formatReviewIssue(issue)}
              </li>
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

      <HouseholdProfileCard
        profile={householdProfile}
        onChange={updateHouseholdProfile}
      />

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
                  onChange={(value) =>
                    category === 'internet'
                      ? updateHouseholdProfile({
                          ...householdProfile,
                          internetMonthlyCost: value,
                        })
                      : recurring(category, value)
                  }
                  onReset={() =>
                    category === 'internet'
                      ? updateHouseholdProfile({
                          ...householdProfile,
                          internetMonthlyCost: undefined,
                        })
                      : update((current) => resetUtility(current, category))
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
                      <DefaultedNumberInput
                        value={analysis.paidLaundry[key]}
                        defaultValue={0}
                        step={0.25}
                        onCommit={(value) =>
                          update((current) => ({
                            ...current,
                            paidLaundry: {
                              ...current.paidLaundry,
                              [key]: value,
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
        </ReviewDisclosure>
      )}

      {!confirmed && (
        <PropertyNotesEditor
          notes={analysis.propertyNotes ?? []}
          onAdd={addPropertyNote}
          onRemove={(id) =>
            update((current) => ({
              ...current,
              propertyNotes: (current.propertyNotes ?? []).filter(
                (note) => note.id !== id,
              ),
              updatedAt: new Date().toISOString(),
            }))
          }
        />
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
            disabled={!validation.valid || aiBlocked || unresolvedCharges}
            aria-describedby="confirm-help"
            onClick={() => setConfirmedRevision(confirmationKey)}
          >
            {aiBlocked
              ? 'Waiting for AI review'
              : unresolvedCharges
                ? 'Review charges above'
                : 'Confirm'}
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
                description="The monthly rent shown by the listing before utilities, recurring fees, or discounts. This is the starting point for the other monthly calculations."
              />
              <Result
                label="Estimated true monthly cost"
                value={results.monthly}
                description="Advertised rent plus known or estimated utilities, insurance, and other recurring expenses. Refundable deposits and one-time move-in costs are not included."
                featured
              />
              <Result
                label="Move-in cash required"
                value={results.moveIn}
                description="The total of all known upfront amounts due around move-in, including deposits, entered rent payments, and fees. Missing upfront charges are not assumed, so confirm this amount with the landlord."
              />
              <Result
                label="Refundable deposits"
                value={results.deposits}
                description="Security, pet, and utility deposits that are expected to be returned if their conditions are met. They affect cash needed at move-in but are not treated as a housing expense."
              />
              <Result
                label="Nonrefundable move-in expenses"
                value={results.nonrefundable}
                description="Known application, administrative, and other nonrefundable move-in fees. These are expenses rather than deposits and are included in the first-year total."
              />
              <Result
                label="First-year total"
                value={results.firstYear}
                description="Twelve months of effective monthly cost after concessions, plus known nonrefundable move-in expenses. Refundable deposits are excluded because they may be returned."
              />
              <Result
                label="Effective rent"
                value={results.effective}
                description="Advertised rent after spreading free months or a one-time credit across the lease term. It covers rent only and does not include utilities or other recurring costs."
              />
              <Result
                label="Effective monthly cost after concessions"
                value={results.effectiveMonthlyCost}
                description="Effective rent plus utilities, insurance, and other known or estimated recurring expenses. With no concessions, this equals the estimated true monthly cost."
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
  description,
  featured = false,
}: {
  label: string;
  value?: number;
  description: string;
  featured?: boolean;
}) {
  const tooltipId = useId();
  return (
    <div className={`result-row${featured ? ' featured' : ''}`}>
      <dt>
        {label}
        <span className="result-help">
          <button
            type="button"
            className="result-help-icon"
            aria-label={`Explain ${label}`}
            aria-describedby={tooltipId}
          >
            ?
          </button>
          <span className="result-tooltip" id={tooltipId} role="tooltip">
            {description}
          </span>
        </span>
      </dt>
      <dd>{value === undefined ? 'Unknown' : MONEY.format(value)}</dd>
    </div>
  );
}
