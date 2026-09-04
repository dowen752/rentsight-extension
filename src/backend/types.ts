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
