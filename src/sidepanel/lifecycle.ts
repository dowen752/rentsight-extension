import type { PageInfo } from '../shared/messages';
import type { RentalAnalysis, RentalAnalysisMap } from '../shared/analysis';
import type { HouseholdProfile } from '../shared/household';
import type { SavedListingRecord } from '../saved';
import { applyHouseholdProfile } from '../shared/analysis';
import { analysisForNavigation } from './navigationState';

export interface ReadyViewState {
  status: 'ready';
  aiPage?: PageInfo;
  url: string;
  analysis: RentalAnalysis;
  savedListings: SavedListingRecord[];
  onboardingCompleted: boolean;
  householdProfile: HouseholdProfile;
}

export type ViewState =
  | { status: 'loading' }
  | { status: 'data-cleared' }
  | { status: 'unit-selection-required' }
  | { status: 'unsupported'; url: string; title: string }
  | ReadyViewState
  | { status: 'error'; message: string };

export function preserveReadyViewAfterInspectionFailure(
  current: ViewState,
  message: string,
): ViewState {
  return current.status === 'ready' ? current : { status: 'error', message };
}

export function refreshReadyView(
  current: ReadyViewState,
  payload: PageInfo,
  stored: RentalAnalysisMap | undefined,
): ReadyViewState {
  const analysis = analysisForNavigation(
    current.analysis,
    payload.url,
    payload.title,
    payload.extraction,
    stored,
  );
  return {
    ...current,
    url: payload.url,
    aiPage: payload,
    analysis: applyHouseholdProfile(analysis, current.householdProfile),
  };
}
