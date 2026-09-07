import { describe, expect, it } from 'vitest';
import { emptyExtraction } from '../src/extractors/types';
import { createInitialAnalysis } from '../src/shared/analysis';
import { DEFAULT_HOUSEHOLD_PROFILE } from '../src/shared/household';
import {
  isSameListingPage,
  preserveReadyViewAfterInspectionFailure,
  refreshReadyView,
  shouldPreserveActiveExtraction,
  type ReadyViewState,
} from '../src/sidepanel/lifecycle';

const listingUrl = 'https://example.com/listing/one';

function readyView(): ReadyViewState {
  return {
    status: 'ready',
    url: listingUrl,
    analysis: createInitialAnalysis(listingUrl, 'Original listing'),
    savedListings: [],
    onboardingCompleted: true,
    householdProfile: { ...DEFAULT_HOUSEHOLD_PROFILE },
  };
}

describe('side-panel inspection lifecycle', () => {
  it('preserves an active extraction when the page republishes the same listing', () => {
    const current = {
      url: `${listingUrl}#details`,
      title: 'Listing',
      appearsToBeRentalListing: true,
      selectedUnitId: 'unit-1',
    };
    const update = { ...current, url: listingUrl, title: 'Updated listing' };

    expect(isSameListingPage(current, update)).toBe(true);
    expect(
      shouldPreserveActiveExtraction(current, update, {
        status: 'extracting',
        requestId: 'request-1',
      }),
    ).toBe(true);
    expect(
      shouldPreserveActiveExtraction(current, update, {
        status: 'succeeded',
        requestId: 'request-1',
      }),
    ).toBe(false);
  });

  it('does not preserve extraction when the selected unit changes', () => {
    const current = {
      url: listingUrl,
      title: 'Listing',
      appearsToBeRentalListing: true,
      selectedUnitId: 'unit-1',
    };
    const update = { ...current, selectedUnitId: 'unit-2' };

    expect(isSameListingPage(current, update)).toBe(false);
    expect(
      shouldPreserveActiveExtraction(current, update, {
        status: 'preparing',
      }),
    ).toBe(false);
  });

  it('keeps a successful extraction when another tab becomes active', () => {
    const current = readyView();
    expect(
      preserveReadyViewAfterInspectionFailure(
        current,
        'The active tab cannot be inspected.',
      ),
    ).toBe(current);
  });

  it('keeps a successful extraction while Google sign-in changes focus', () => {
    const current = readyView();
    expect(
      preserveReadyViewAfterInspectionFailure(
        current,
        'The authentication window cannot be inspected.',
      ),
    ).toBe(current);
  });

  it.each(['chrome://extensions', 'chrome-extension://auth-popup'])(
    'keeps a successful extraction when %s becomes active',
    (activeUrl) => {
      const current = readyView();
      expect(
        preserveReadyViewAfterInspectionFailure(
          current,
          `${activeUrl} cannot be inspected.`,
        ),
      ).toBe(current);
    },
  );

  it('keeps the previous extraction after an explicit refresh fails', () => {
    const current = readyView();
    const result = preserveReadyViewAfterInspectionFailure(
      current,
      'Return to the listing tab and try Refresh again.',
    );
    expect(result).toBe(current);
    expect(result.status === 'ready' && result.analysis).toBe(current.analysis);
  });

  it('updates the extraction after returning to an accessible listing', () => {
    const current = readyView();
    const nextUrl = 'https://example.com/listing/two';
    const extraction = emptyExtraction('Test listing', '1.0.0');
    extraction.listing.recurring.advertisedRent = {
      value: 2_450,
      source: 'listing',
      confidence: 0.95,
    };

    const result = refreshReadyView(
      current,
      {
        url: nextUrl,
        title: 'Updated listing',
        appearsToBeRentalListing: true,
        extraction,
      },
      undefined,
    );

    expect(result.url).toBe(nextUrl);
    expect(result.analysis.listing.identity.url?.value).toBe(nextUrl);
    expect(result.analysis.listing.recurring.advertisedRent?.value).toBe(2_450);
  });

  it('shows an instructional state when no extraction exists', () => {
    expect(
      preserveReadyViewAfterInspectionFailure(
        { status: 'loading' },
        'Open a rental listing and invoke RentSight to begin.',
      ),
    ).toEqual({
      status: 'error',
      message: 'Open a rental listing and invoke RentSight to begin.',
    });
  });
});
