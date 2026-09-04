export interface HouseholdProfile {
  occupants: number;
  smallDogs: number;
  largeDogs: number;
  otherPets: boolean;
  internetMonthlyCost?: number;
}

export const DEFAULT_HOUSEHOLD_PROFILE: Readonly<HouseholdProfile> = {
  occupants: 1,
  smallDogs: 0,
  largeDogs: 0,
  otherPets: false,
};

export function normalizeHouseholdProfile(
  value: Partial<HouseholdProfile> | undefined,
): HouseholdProfile {
  const wholeNumber = (
    candidate: unknown,
    fallback: number,
    minimum: number,
  ) =>
    typeof candidate === 'number' && Number.isFinite(candidate)
      ? Math.max(minimum, Math.floor(candidate))
      : fallback;
  const money = value?.internetMonthlyCost;
  return {
    occupants: wholeNumber(value?.occupants, 1, 1),
    smallDogs: wholeNumber(value?.smallDogs, 0, 0),
    largeDogs: wholeNumber(value?.largeDogs, 0, 0),
    otherPets: value?.otherPets === true,
    internetMonthlyCost:
      typeof money === 'number' && Number.isFinite(money) && money >= 0
        ? money
        : undefined,
  };
}

export function householdHasPets(profile: HouseholdProfile): boolean {
  return profile.smallDogs > 0 || profile.largeDogs > 0 || profile.otherPets;
}
