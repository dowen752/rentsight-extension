/** Transparent placeholder factors relative to the national utility defaults. */
export const REGIONAL_UTILITY_FACTORS: Readonly<Record<string, number>> = {
  CA: 1.15,
  FL: 1.08,
  IL: 1.04,
  MA: 1.2,
  NY: 1.18,
  OR: 0.96,
  TX: 1.05,
  WA: 0.92,
};

export const DEFAULT_REGIONAL_UTILITY_FACTOR = 1;
