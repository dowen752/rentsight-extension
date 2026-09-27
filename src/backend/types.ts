export type EntitlementKey = 'plus';

export interface AccountEntitlement {
  key: EntitlementKey;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';
  active: boolean;
  source?: 'pass';
  expiresAt?: string;
}

export interface AccountEntitlements {
  entitlements: AccountEntitlement[];
}

export interface BillingLink {
  url: string;
}

export interface BackendErrorBody {
  error?: string;
  message?: string;
}

export interface StructuredBackendErrorBody {
  schemaVersion: '1.0';
  error: {
    code: string;
    message: string;
    retryable: boolean;
    retryAfterSeconds?: number;
  };
}

export interface ParsedBackendError {
  code?: string;
  message?: string;
  retryable?: boolean;
  retryAfterSeconds?: number;
}

export const parseBackendError = (value: unknown): ParsedBackendError => {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return {};
  const record = value as Record<string, unknown>;
  if (
    record.schemaVersion === '1.0' &&
    typeof record.error === 'object' &&
    record.error !== null &&
    !Array.isArray(record.error)
  ) {
    const error = record.error as Record<string, unknown>;
    if (
      typeof error.code === 'string' &&
      typeof error.message === 'string' &&
      typeof error.retryable === 'boolean'
    ) {
      const retryAfterSeconds =
        typeof error.retryAfterSeconds === 'number' &&
        Number.isFinite(error.retryAfterSeconds) &&
        error.retryAfterSeconds >= 0
          ? error.retryAfterSeconds
          : undefined;
      return {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
        ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
      };
    }
  }
  return {
    ...(typeof record.error === 'string' ? { code: record.error } : {}),
    ...(typeof record.message === 'string'
      ? { message: record.message }
      : typeof record.error === 'string'
        ? { message: record.error }
        : {}),
  };
};

export const isAccountEntitlements = (
  value: unknown,
): value is AccountEntitlements => {
  if (typeof value !== 'object' || value === null) return false;
  const entitlements = Reflect.get(value, 'entitlements');
  return (
    Array.isArray(entitlements) &&
    entitlements.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        Reflect.get(item, 'key') === 'plus' &&
        typeof Reflect.get(item, 'active') === 'boolean' &&
        ['active', 'trialing', 'past_due', 'canceled', 'none'].includes(
          String(Reflect.get(item, 'status')),
        ) &&
        (Reflect.get(item, 'expiresAt') === undefined ||
          typeof Reflect.get(item, 'expiresAt') === 'string'),
    )
  );
};

export const isBillingLink = (value: unknown): value is BillingLink =>
  typeof value === 'object' &&
  value !== null &&
  typeof Reflect.get(value, 'url') === 'string';
