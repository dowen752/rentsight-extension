import type {
  RentalListing,
  SourcedValue,
  UtilityEstimationInput,
} from './models';

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

function sourcedEntries<T extends object>(
  object: T,
): [string, SourcedValue<unknown> | undefined][] {
  return Object.entries(object) as [
    string,
    SourcedValue<unknown> | undefined,
  ][];
}

function validateSourcedValue(
  field: SourcedValue<unknown>,
  path: string,
  errors: ValidationError[],
): void {
  if (
    !Number.isFinite(field.confidence) ||
    field.confidence < 0 ||
    field.confidence > 1
  ) {
    errors.push({
      path: `${path}.confidence`,
      message: 'Confidence must be between 0 and 1.',
    });
  }
}

export function validateRentalListing(
  listing: RentalListing,
): ValidationResult {
  const errors: ValidationError[] = [];
  const groups: [string, object][] = [
    ['identity', listing.identity],
    ['recurring', listing.recurring],
    ['upfront', listing.upfront],
    ['concessions', listing.concessions ?? {}],
  ];

  for (const [groupName, group] of groups) {
    for (const [name, field] of sourcedEntries(group)) {
      if (!field) continue;
      const path = `${groupName}.${name}`;
      validateSourcedValue(field, path, errors);
      const isCoordinate =
        path === 'identity.latitude' || path === 'identity.longitude';
      if (
        typeof field.value === 'number' &&
        (!Number.isFinite(field.value) || (!isCoordinate && field.value < 0))
      ) {
        errors.push({
          path: `${path}.value`,
          message: 'Value must be a finite, non-negative number.',
        });
      }
    }
  }

  const housingType = listing.identity.housingType?.value;
  if (
    housingType !== undefined &&
    !['apartment', 'condo', 'townhouse', 'single_family', 'other'].includes(
      housingType,
    )
  ) {
    errors.push({
      path: 'identity.housingType.value',
      message: 'Choose a supported housing type.',
    });
  }
  const latitude = listing.identity.latitude?.value;
  const longitude = listing.identity.longitude?.value;
  const squareFootage = listing.identity.squareFootage?.value;
  const url = listing.identity.url?.value;
  const leaseMonths = listing.concessions?.leaseMonths?.value;
  const monthsFree = listing.concessions?.monthsFree?.value;
  if (latitude !== undefined && (latitude < -90 || latitude > 90)) {
    errors.push({
      path: 'identity.latitude.value',
      message: 'Latitude must be between -90 and 90.',
    });
  }
  if (longitude !== undefined && (longitude < -180 || longitude > 180)) {
    errors.push({
      path: 'identity.longitude.value',
      message: 'Longitude must be between -180 and 180.',
    });
  }
  if (squareFootage !== undefined && squareFootage === 0) {
    errors.push({
      path: 'identity.squareFootage.value',
      message: 'Square footage must be greater than zero.',
    });
  }
  if (url !== undefined) {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    } catch {
      errors.push({
        path: 'identity.url.value',
        message: 'URL must be a valid HTTP or HTTPS URL.',
      });
    }
  }
  if (
    leaseMonths !== undefined &&
    (!Number.isInteger(leaseMonths) || leaseMonths < 1)
  ) {
    errors.push({
      path: 'concessions.leaseMonths.value',
      message: 'Lease duration must be a whole number of at least one month.',
    });
  }
  if (
    monthsFree !== undefined &&
    leaseMonths !== undefined &&
    monthsFree > leaseMonths
  ) {
    errors.push({
      path: 'concessions.monthsFree.value',
      message: 'Free months cannot exceed the lease duration.',
    });
  }

  return { valid: errors.length === 0, errors };
}

export function validateUtilityEstimationInput(
  input: UtilityEstimationInput,
): ValidationResult {
  const errors: ValidationError[] = [];
  if (!Number.isInteger(input.occupants) || input.occupants < 1) {
    errors.push({
      path: 'occupants',
      message: 'Occupants must be a whole number of at least 1.',
    });
  }
  if (
    input.bedrooms !== undefined &&
    (!Number.isFinite(input.bedrooms) || input.bedrooms < 0)
  ) {
    errors.push({
      path: 'bedrooms',
      message: 'Bedrooms must be a finite, non-negative number.',
    });
  }
  if (
    input.squareFootage !== undefined &&
    (!Number.isFinite(input.squareFootage) || input.squareFootage <= 0)
  ) {
    errors.push({
      path: 'squareFootage',
      message: 'Square footage must be greater than zero.',
    });
  }
  return { valid: errors.length === 0, errors };
}

export class CalculationValidationError extends Error {
  constructor(public readonly errors: ValidationError[]) {
    super(errors.map(({ path, message }) => `${path}: ${message}`).join('; '));
    this.name = 'CalculationValidationError';
  }
}

export function assertValidListing(listing: RentalListing): void {
  const result = validateRentalListing(listing);
  if (!result.valid) throw new CalculationValidationError(result.errors);
}
