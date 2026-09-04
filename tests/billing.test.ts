import { describe, expect, it } from 'vitest';
import {
  InvalidBillingUrlError,
  validateExternalBillingUrl,
} from '../src/backend/billing';

describe('billing URL validation', () => {
  it('accepts HTTPS URLs', () => {
    expect(
      validateExternalBillingUrl('https://checkout.stripe.com/c/pay'),
    ).toBe('https://checkout.stripe.com/c/pay');
  });

  it.each(['javascript:alert(1)', 'http://checkout.stripe.com', 'not a url'])(
    'rejects unsafe URL %s',
    (url) => {
      expect(() => validateExternalBillingUrl(url)).toThrow(
        InvalidBillingUrlError,
      );
    },
  );
});
