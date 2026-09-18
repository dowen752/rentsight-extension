import type { ExtractionFailure } from './types';

export const extractionMessages: Record<
  ExtractionFailure['error']['code'],
  string
> = {
  INVALID_REQUEST:
    'The listing capture could not be submitted. Refresh the listing and try again.',
  UNAUTHENTICATED: 'Sign in again to use AI extraction.',
  ENTITLEMENT_REQUIRED: 'AI extraction requires an active Plus membership.',
  USAGE_LIMIT_EXCEEDED: 'Your AI extraction allowance has been reached.',
  RATE_LIMITED: 'AI extraction is busy. Wait before retrying.',
  IDEMPOTENCY_CONFLICT:
    'This extraction request could not be reused. Refresh the listing.',
  EXTRACTION_IN_PROGRESS:
    'The original AI review is still processing. Wait before checking again.',
  UNUSABLE_CAPTURE:
    'There was not enough listing content to review. Open the listing details and capture again.',
  MODEL_REFUSAL: 'AI could not review this listing.',
  MODEL_OUTPUT_TRUNCATED:
    'AI could not complete its review. Your preliminary values were kept.',
  MODEL_OUTPUT_INVALID:
    'AI could not verify its review, but the listing details already shown below were kept. Review them and continue, or load the listing and try AI again.',
  MODEL_EVIDENCE_INVALID:
    'AI reviewed the listing, but its supporting details could not be verified. Your preliminary values were kept.',
  UPSTREAM_TIMEOUT:
    'AI review took too long to finish. Your preliminary values were kept.',
  UPSTREAM_UNAVAILABLE:
    'AI review is temporarily unavailable. Your preliminary values were kept.',
  INTERNAL_ERROR:
    'AI review could not finish. Your preliminary values were kept.',
};
export const extractionErrorMessage = (
  code: ExtractionFailure['error']['code'],
) => extractionMessages[code];
