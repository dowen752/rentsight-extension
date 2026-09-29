export interface HouseholdProfile {
  occupants: number;
  cats: number;
  smallDogs: number;
  largeDogs: number;
}

type StoredHouseholdProfile = Partial<HouseholdProfile> & {
  /** Legacy field retained only while normalizing profiles saved by older builds. */
  otherPets?: unknown;
  /** Legacy field retained only while normalizing profiles saved by older builds. */
  internetMonthlyCost?: unknown;
};

export const DEFAULT_HOUSEHOLD_PROFILE: Readonly<HouseholdProfile> = {
  occupants: 1,
  cats: 0,
  smallDogs: 0,
  largeDogs: 0,
};

export function normalizeHouseholdProfile(
  value: StoredHouseholdProfile | undefined,
): HouseholdProfile {
  const wholeNumber = (
    candidate: unknown,
    fallback: number,
    minimum: number,
  ) =>
    typeof candidate === 'number' && Number.isFinite(candidate)
      ? Math.max(minimum, Math.floor(candidate))
      : fallback;
  return {
    occupants: wholeNumber(value?.occupants, 1, 1),
    cats: wholeNumber(value?.cats, value?.otherPets === true ? 1 : 0, 0),
    smallDogs: wholeNumber(value?.smallDogs, 0, 0),
    largeDogs: wholeNumber(value?.largeDogs, 0, 0),
  };
}

export function householdHasPets(profile: HouseholdProfile): boolean {
  return profile.cats > 0 || profile.smallDogs > 0 || profile.largeDogs > 0;
}
