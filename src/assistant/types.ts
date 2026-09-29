import type { RentalSearch, SearchCriterion } from '../search';

export const ASSISTANT_ACTION_VERSIONS = {
  'search.patch': '1.0',
  'analysis.set_cost': '1.0',
  'property_note.add': '1.0',
  'saved_listing.set_cost': '1.0',
  'saved_listing.set_field': '1.0',
  'saved_listing.clear_field': '1.0',
  'saved_listing.add_custom_fee': '1.0',
  'saved_listing.update_custom_fee': '1.0',
  'saved_listing.remove_custom_fee': '1.0',
  'saved_listing.add_note': '1.0',
  'saved_listing.remove_note': '1.0',
  'workspace.navigate': '1.0',
} as const;

export type AssistantWorkspace =
  'find' | 'current' | 'saved' | 'compare' | 'unavailable';

export interface AssistantContext {
  activeView: AssistantWorkspace;
  currentListing?: Record<string, unknown>;
  currentCalculation?: Record<string, unknown>;
  extractionNotes?: Record<string, unknown>[];
  userNotes?: Record<string, unknown>[];
  reviewIssues?: Record<string, unknown>[];
  search?: RentalSearch;
  selectedListings?: Record<string, unknown>[];
  location?: Record<string, unknown>;
}

export interface AssistantConversationSummary {
  conversationId: string;
  title: string;
  preview: string;
  createdAt: string;
  updatedAt: string;
  turnCount: number;
}

export interface AssistantConversationPage {
  schemaVersion: '1.0';
  conversations: AssistantConversationSummary[];
  nextCursor: string | null;
}

export interface AssistantHistoryTurn {
  clientRequestId: string;
  createdAt: string;
  completedAt: string;
  userMessage: { text: string };
  assistantMessage: {
    messageId: string;
    format: 'markdown';
    text: string;
  };
}

export interface AssistantConversationTurnsPage {
  schemaVersion: '1.0';
  conversation: Omit<AssistantConversationSummary, 'preview' | 'turnCount'>;
  turns: AssistantHistoryTurn[];
  nextCursor: string | null;
}

export interface AssistantActionOutcome {
  proposalId: string;
  status: 'applied' | 'rejected' | 'failed' | 'stale';
  resultRevision?: string;
}

export interface AssistantRequest {
  schemaVersion: '1.0';
  clientRequestId: string;
  conversationId?: string;
  message: string;
  contextRevision?: string;
  context?: AssistantContext;
  capabilities: {
    actions: Partial<typeof ASSISTANT_ACTION_VERSIONS>;
  };
  actionOutcomes?: AssistantActionOutcome[];
}

interface ProposalBase {
  id: string;
  explanation: string;
}

export interface SearchPatchProposal extends ProposalBase {
  type: 'search.patch';
  arguments: {
    set: Partial<RentalSearch>;
    clear: SearchCriterion[];
  };
}

export const ASSISTANT_COST_FREQUENCIES = {
  electricity: 'monthly',
  naturalGas: 'monthly',
  water: 'monthly',
  sewer: 'monthly',
  trash: 'monthly',
  internet: 'monthly',
  parking: 'monthly',
  laundry: 'monthly',
  petRent: 'monthly',
  rentersInsurance: 'monthly',
  amenityFees: 'monthly',
  otherRequiredMonthlyFees: 'monthly',
  applicationFee: 'one_time',
  securityDeposit: 'one_time',
  firstMonthsRent: 'one_time',
  lastMonthsRent: 'one_time',
  petDeposit: 'one_time',
  petFee: 'one_time',
  administrativeFee: 'one_time',
  utilityDeposits: 'one_time',
  otherMoveInFees: 'one_time',
} as const;

export type EditableCostCategory = keyof typeof ASSISTANT_COST_FREQUENCIES;

export const SAVED_LISTING_SETTABLE_FIELDS = [
  'identity.listingTitle',
  'identity.fullAddress',
  'identity.city',
  'identity.state',
  'identity.zipCode',
  'identity.url',
  'identity.bedrooms',
  'identity.bathrooms',
  'identity.squareFootage',
  'recurring.advertisedRent',
  'concessions.monthsFree',
  'concessions.oneTimeCredit',
  'concessions.leaseMonths',
  'utilityIncluded.electricity',
  'utilityIncluded.naturalGas',
  'utilityIncluded.water',
  'utilityIncluded.sewer',
  'utilityIncluded.trash',
  'utilityIncluded.internet',
  'laundryType',
  'paidLaundry.washPrice',
  'paidLaundry.dryPrice',
  'paidLaundry.loadsPerWeek',
] as const;
export type SavedListingSettableField =
  (typeof SAVED_LISTING_SETTABLE_FIELDS)[number];

export const SAVED_LISTING_CLEARABLE_FIELDS = [
  'identity.listingTitle',
  'identity.fullAddress',
  'identity.city',
  'identity.state',
  'identity.zipCode',
  'identity.bedrooms',
  'identity.bathrooms',
  'identity.squareFootage',
  'recurring.advertisedRent',
  'recurring.electricity',
  'recurring.naturalGas',
  'recurring.water',
  'recurring.sewer',
  'recurring.trash',
  'recurring.internet',
  'recurring.parking',
  'recurring.laundry',
  'recurring.petRent',
  'recurring.rentersInsurance',
  'recurring.amenityFees',
  'recurring.otherRequiredMonthlyFees',
  'upfront.applicationFee',
  'upfront.securityDeposit',
  'upfront.firstMonthsRent',
  'upfront.lastMonthsRent',
  'upfront.petDeposit',
  'upfront.petFee',
  'upfront.administrativeFee',
  'upfront.utilityDeposits',
  'upfront.otherMoveInFees',
  'concessions.monthsFree',
  'concessions.oneTimeCredit',
  'concessions.leaseMonths',
] as const;
export type SavedListingClearableField =
  (typeof SAVED_LISTING_CLEARABLE_FIELDS)[number];

type CostArguments = {
  [Category in EditableCostCategory]: {
    category: Category;
    amount: number;
    currency: 'USD';
    frequency: (typeof ASSISTANT_COST_FREQUENCIES)[Category];
  };
}[EditableCostCategory];

export type SetCostProposal = ProposalBase & {
  type: 'analysis.set_cost';
  arguments: CostArguments;
};

export type SavedListingSetCostProposal = ProposalBase & {
  type: 'saved_listing.set_cost';
  contextRevision: string;
  arguments: CostArguments & { listingId: string };
};

export interface SavedListingSetFieldProposal extends ProposalBase {
  type: 'saved_listing.set_field';
  contextRevision: string;
  arguments: {
    listingId: string;
    field: SavedListingSettableField;
    value: string | number | boolean;
  };
}

export interface SavedListingClearFieldProposal extends ProposalBase {
  type: 'saved_listing.clear_field';
  contextRevision: string;
  arguments: { listingId: string; field: SavedListingClearableField };
}

export interface SavedListingAddCustomFeeProposal extends ProposalBase {
  type: 'saved_listing.add_custom_fee';
  contextRevision: string;
  arguments: {
    listingId: string;
    cadence: 'monthly' | 'one_time';
    label: string;
    amount: number;
  };
}

export interface SavedListingUpdateCustomFeeProposal extends ProposalBase {
  type: 'saved_listing.update_custom_fee';
  contextRevision: string;
  arguments: {
    listingId: string;
    cadence: 'monthly' | 'one_time';
    feeId: string;
    label: string;
    amount: number;
  };
}

export interface SavedListingRemoveCustomFeeProposal extends ProposalBase {
  type: 'saved_listing.remove_custom_fee';
  contextRevision: string;
  arguments: {
    listingId: string;
    cadence: 'monthly' | 'one_time';
    feeId: string;
  };
}

export interface AddPropertyNoteProposal extends ProposalBase {
  type: 'property_note.add';
  arguments: { text: string };
}

export interface SavedListingAddNoteProposal extends ProposalBase {
  type: 'saved_listing.add_note';
  contextRevision: string;
  arguments: { listingId: string; text: string };
}

export interface SavedListingRemoveNoteProposal extends ProposalBase {
  type: 'saved_listing.remove_note';
  contextRevision: string;
  arguments: { listingId: string; noteId: string };
}

export type SavedListingProposal =
  | SavedListingSetCostProposal
  | SavedListingSetFieldProposal
  | SavedListingClearFieldProposal
  | SavedListingAddCustomFeeProposal
  | SavedListingUpdateCustomFeeProposal
  | SavedListingRemoveCustomFeeProposal
  | SavedListingAddNoteProposal
  | SavedListingRemoveNoteProposal;

export interface NavigateProposal extends ProposalBase {
  type: 'workspace.navigate';
  arguments: { destination: 'find' | 'current' | 'saved' | 'compare' };
}

export type AssistantProposal =
  | SearchPatchProposal
  | SetCostProposal
  | AddPropertyNoteProposal
  | SavedListingProposal
  | NavigateProposal;

export interface AssistantCitation {
  id: string;
  title: string;
  url?: string;
  retrievedAt?: string;
}

export interface AssistantResponse {
  schemaVersion: '1.0';
  conversationId: string;
  messageId: string;
  contextRevision?: string;
  message: { format: 'markdown'; text: string };
  proposals: AssistantProposal[];
  citations?: AssistantCitation[];
  followUpSuggestions?: string[];
}

export interface StoredAssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  response?: AssistantResponse;
}

export interface StoredAssistantConversation {
  schemaVersion: '1.0';
  conversationId?: string;
  messages: StoredAssistantMessage[];
  outcomes: AssistantActionOutcome[];
  pendingOutcomes: AssistantActionOutcome[];
}
