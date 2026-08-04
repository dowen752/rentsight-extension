import type { HousingType, UtilityCategory } from './models';

export interface CostAssumptions {
  utilities: Record<UtilityCategory, number>;
  additionalOccupantMultiplier: number;
  bedroomAdjustment: number;
  squareFootageBaseline: number;
  squareFootageAdjustmentPer500: number;
  housingTypeMultiplier: Record<HousingType, number>;
  paidSharedLaundry: number;
  defaultRentersInsurance: number;
}

/**
 * Transparent national placeholder assumptions. These are intentionally simple
 * until location-specific data sources are introduced.
 */
export const DEFAULT_COST_ASSUMPTIONS: Readonly<CostAssumptions> = {
  utilities: {
    electricity: 90,
    naturalGas: 45,
    water: 35,
    sewer: 25,
    trash: 25,
    internet: 60,
  },
  additionalOccupantMultiplier: 0.15,
  bedroomAdjustment: 0.08,
  squareFootageBaseline: 800,
  squareFootageAdjustmentPer500: 0.05,
  housingTypeMultiplier: {
    apartment: 1,
    condo: 1,
    townhouse: 1.1,
    single_family: 1.2,
    other: 1,
  },
  paidSharedLaundry: 24,
  defaultRentersInsurance: 15,
};
