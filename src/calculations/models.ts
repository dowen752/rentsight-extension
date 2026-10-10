export type ValueSource = 'listing' | 'user' | 'location_estimate' | 'default';

export interface SourcedValue<T> {
  value: T;
  source: ValueSource;
  confidence: number;
  note?: string;
}

export interface ListingIdentity {
  url?: SourcedValue<string>;
  listingTitle?: SourcedValue<string>;
  fullAddress?: SourcedValue<string>;
  city?: SourcedValue<string>;
  state?: SourcedValue<string>;
  zipCode?: SourcedValue<string>;
  latitude?: SourcedValue<number>;
  longitude?: SourcedValue<number>;
  bedrooms?: SourcedValue<number>;
  bathrooms?: SourcedValue<number>;
  squareFootage?: SourcedValue<number>;
  housingType?: SourcedValue<HousingType>;
}

export interface RecurringCosts {
  advertisedRent?: SourcedValue<number>;
  electricity?: SourcedValue<number>;
  naturalGas?: SourcedValue<number>;
  water?: SourcedValue<number>;
  sewer?: SourcedValue<number>;
  trash?: SourcedValue<number>;
  internet?: SourcedValue<number>;
  parking?: SourcedValue<number>;
  laundry?: SourcedValue<number>;
  petRent?: SourcedValue<number>;
  rentersInsurance?: SourcedValue<number>;
  amenityFees?: SourcedValue<number>;
  otherRequiredMonthlyFees?: SourcedValue<number>;
}

export interface UpfrontCosts {
  applicationFee?: SourcedValue<number>;
  securityDeposit?: SourcedValue<number>;
  firstMonthsRent?: SourcedValue<number>;
  lastMonthsRent?: SourcedValue<number>;
  petDeposit?: SourcedValue<number>;
  petFee?: SourcedValue<number>;
  administrativeFee?: SourcedValue<number>;
  utilityDeposits?: SourcedValue<number>;
  otherMoveInFees?: SourcedValue<number>;
}

export interface RentConcessions {
  monthsFree?: SourcedValue<number>;
  oneTimeCredit?: SourcedValue<number>;
  leaseMonths?: SourcedValue<number>;
}

export interface RentalListing {
  identity: ListingIdentity;
  recurring: RecurringCosts;
  upfront: UpfrontCosts;
  concessions?: RentConcessions;
}

export type HousingType =
  'apartment' | 'condo' | 'townhouse' | 'single_family' | 'other';

export type UtilityCategory =
  'electricity' | 'naturalGas' | 'water' | 'sewer' | 'trash' | 'internet';

export type LaundryType =
  | 'in_unit'
  | 'shared_paid'
  | 'shared_free'
  | 'hookups_only'
  | 'none'
  | 'unknown';

export interface UtilityEstimationInput {
  location?: {
    city?: string;
    state?: string;
    zipCode?: string;
  };
  bedrooms?: number;
  squareFootage?: number;
  occupants: number;
  housingType: HousingType;
  includedUtilities: readonly UtilityCategory[];
  laundryType?: LaundryType;
}

export interface CalculationContext {
  utilityEstimation?: UtilityEstimationInput;
}

export type RecurringCostCategory = keyof RecurringCosts;
export type UpfrontCostCategory = keyof UpfrontCosts;

export interface MissingCostCategory {
  category: RecurringCostCategory | UpfrontCostCategory;
  label: string;
  cadence: 'monthly' | 'upfront';
  reason: string;
}
