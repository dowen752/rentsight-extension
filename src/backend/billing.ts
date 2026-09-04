import type { RentSightBackendClient } from './client';

export class InvalidBillingUrlError extends Error {
  constructor() {
    super('RentSight cloud services returned an invalid billing URL.');
  }
}

export const validateExternalBillingUrl = (value: string): string => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new InvalidBillingUrlError();
  }
  if (
    url.protocol !== 'https:' ||
    !url.hostname ||
    url.username ||
    url.password
  )
    throw new InvalidBillingUrlError();
  return url.href;
};

export interface BillingNavigator {
  openExternal(url: string): Promise<void>;
}

export const chromeBillingNavigator: BillingNavigator = {
  async openExternal(url) {
    await chrome.tabs.create({ url });
  },
};

export const openCheckout = async (
  client: RentSightBackendClient,
  navigator: BillingNavigator = chromeBillingNavigator,
): Promise<void> => {
  const { url } = await client.createCheckout();
  await navigator.openExternal(validateExternalBillingUrl(url));
};

export const openBillingPortal = async (
  client: RentSightBackendClient,
  navigator: BillingNavigator = chromeBillingNavigator,
): Promise<void> => {
  const { url } = await client.createBillingPortal();
  await navigator.openExternal(validateExternalBillingUrl(url));
};
