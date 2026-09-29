import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NumberField } from '../src/sidepanel/Fields';
import {
  AnalysisEditor,
  FindRentalsView,
  GuidedTour,
  UnavailableWorkspace,
} from '../src/sidepanel/App';
import { analysisForNavigation } from '../src/sidepanel/navigationState';
import {
  applyExtraction,
  createInitialAnalysis,
  setIdentityValue,
  setRecurringValue,
} from '../src/shared/analysis';
import { emptyExtraction } from '../src/extractors/types';

describe('side-panel fields', () => {
  it('renders an accessible value, visible source, and reset control', () => {
    const markup = renderToStaticMarkup(
      <NumberField
        label="Monthly rent"
        field={{ value: 2_100, source: 'user', confidence: 1 }}
        baseline={{ value: 2_000, source: 'listing', confidence: 0.9 }}
        onChange={() => undefined}
        onReset={() => undefined}
      />,
    );
    expect(markup).toContain('aria-label="Monthly rent"');
    expect(markup).toContain('Entered by user');
    expect(markup).toContain('Reset');
  });
  it('uses the existing source badge for retained preliminary values', () => {
    const markup = renderToStaticMarkup(
      <NumberField
        label="Bathrooms"
        field={{ value: 1, source: 'location_estimate', confidence: 0.7 }}
        baseline={{ value: 1, source: 'location_estimate', confidence: 0.7 }}
        onChange={() => undefined}
        onReset={() => undefined}
      />,
    );
    expect(markup).toContain('Local estimate');
    expect(markup).not.toContain('Extracted from listing');
  });
});

describe('analysis review workflow', () => {
  it('warns when a pet household conflicts with an explicit no-pets policy', () => {
    const analysis = createInitialAnalysis(
      'https://example.com/rental/no-pets',
      'No pets rental',
    );
    analysis.extraction = emptyExtraction('Test', '1.0.0');
    analysis.extraction.petPolicy = 'none';
    analysis.extraction.rawPetPolicyText = 'No Pets';
    const householdProfile = {
      occupants: 1,
      cats: 0,
      smallDogs: 1,
      largeDogs: 0,
    };

    const markup = renderToStaticMarkup(
      <AnalysisEditor
        analysis={analysis}
        update={() => undefined}
        householdProfile={householdProfile}
      />,
    );

    expect(markup).toContain('Pet policy conflict');
    expect(markup).toContain('This listing says pets are not allowed');
    expect(markup).toContain('Listing text: No Pets');
  });

  it('shows editable review fields and withholds results until confirmation', () => {
    const markup = renderToStaticMarkup(
      <AnalysisEditor
        analysis={createInitialAnalysis(
          'https://example.com/rental/1',
          'Example rental',
        )}
        update={() => undefined}
      />,
    );
    expect(markup).toContain('Step 1 · Review inputs');
    expect(markup).toContain('Review extracted values');
    expect(markup).toContain('>Confirm</button>');
    expect(markup).not.toContain('id="results-heading"');
    expect(markup.match(/class="review-disclosure"/g)).toHaveLength(5);
    expect(markup).toContain('<span>Utilities</span>');
    expect(markup).toContain('<span>Property expenses</span>');
    expect(markup).toContain('<span>Other details</span>');
    expect(markup).toContain('<span>Move-in costs</span>');
    expect(markup).toContain('<span>Lease and concessions</span>');
    expect(markup).not.toContain('<details class="review-disclosure" open=""');
    expect(markup).toContain('aria-label="Electricity"');
    expect(markup).toContain('aria-label="Security deposit"');
    expect(markup).toContain('aria-label="Listing name (optional)"');
    expect(markup).toContain(
      'placeholder="Give this property any name you like"',
    );
    expect(markup).not.toContain('value="Example rental"');
  });

  it('shows when utility inclusion was changed by the user', () => {
    const analysis = createInitialAnalysis(
      'https://example.com/rental/utility-override',
      'Utility override',
    );
    analysis.utilityIncludedSource.naturalGas = 'user';
    const markup = renderToStaticMarkup(
      <AnalysisEditor analysis={analysis} update={() => undefined} />,
    );

    expect(markup).toContain('Inclusion changed by user');
    expect(markup).toContain('Reset inclusion');
  });

  it('restores a persisted draft when SPA navigation returns to its URL', () => {
    const url = 'https://example.com/rental/saved';
    const stored = setIdentityValue(
      setRecurringValue(
        createInitialAnalysis(url, 'Ignored page title'),
        'advertisedRent',
        2_750,
      ),
      'listingTitle',
      'Stored title',
    );
    const extraction = emptyExtraction('Test', '1.0.0');
    extraction.listing.identity.listingTitle = {
      value: 'Fresh title',
      source: 'listing',
      confidence: 0.9,
    };
    const restored = analysisForNavigation(
      undefined,
      url,
      'Fresh title',
      extraction,
      { [url]: stored },
    );
    expect(restored.listing.recurring.advertisedRent?.value).toBe(2_750);
    expect(restored.listing.recurring.advertisedRent?.source).toBe('user');
    expect(restored.listing.identity.listingTitle?.value).toBe('Stored title');
  });

  it('carries building details into a Zillow child unit navigation', () => {
    const buildingUrl =
      'https://www.zillow.com/b/22639-oakcrest-ct-cupertino-ca/example/';
    const unitUrl =
      'https://www.zillow.com/homedetails/22639-Oakcrest-Ct-B-Cupertino-CA-95014/example/';
    let building = setIdentityValue(
      setIdentityValue(
        createInitialAnalysis(buildingUrl, 'Oakcrest'),
        'fullAddress',
        '22639 Oakcrest Ct',
      ),
      'city',
      'Cupertino',
    );
    const buildingExtraction = emptyExtraction('Generic listing page', '1.0.0');
    buildingExtraction.includedUtilities = ['water'];
    buildingExtraction.rawUtilityText = 'Water is included.';
    building = applyExtraction(building, buildingExtraction);
    const extraction = emptyExtraction('Zillow', '1.1.0');
    extraction.listing.recurring.advertisedRent = {
      value: 3_000,
      source: 'listing',
      confidence: 0.9,
    };
    extraction.listing.identity.squareFootage = {
      value: 300,
      source: 'listing',
      confidence: 0.9,
    };

    const unit = analysisForNavigation(
      building,
      unitUrl,
      'Unit B',
      extraction,
      undefined,
    );

    expect(unit.listing.identity.url?.value).toBe(unitUrl);
    expect(unit.listing.identity.fullAddress?.value).toBe('22639 Oakcrest Ct');
    expect(unit.listing.identity.city?.value).toBe('Cupertino');
    expect(unit.listing.recurring.advertisedRent?.value).toBe(3_000);
    expect(unit.listing.identity.squareFootage?.value).toBe(300);
    expect(unit.utilityIncluded.water).toBe(true);
    expect(unit.extraction?.includedUtilities).toContain('water');
  });
});

describe('guided tour', () => {
  it('identifies the active step and offers accessible navigation', () => {
    const markup = renderToStaticMarkup(
      <GuidedTour
        step={0}
        setStep={() => undefined}
        finish={async () => undefined}
      />,
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('Quick tour · 1 of 6');
    expect(markup).toContain('Set up your search');
    expect(markup).toContain('Skip tour');
    expect(markup).toContain('>Next</button>');
    expect(markup).toContain('disabled=""');
  });

  it('introduces the current listing review after Search', () => {
    const markup = renderToStaticMarkup(
      <GuidedTour
        step={1}
        setStep={() => undefined}
        finish={async () => undefined}
      />,
    );

    expect(markup).toContain('Quick tour · 2 of 6');
    expect(markup).toContain('Review the current listing');
    expect(markup).toContain('correct any assumptions');
  });

  it('finishes by directing people to Search instead of duplicating the form', () => {
    const markup = renderToStaticMarkup(
      <GuidedTour
        step={5}
        setStep={() => undefined}
        finish={async () => undefined}
      />,
    );

    expect(markup).toContain('Quick tour · 6 of 6');
    expect(markup).toContain('Personalize every estimate');
    expect(markup).toContain('Use Your household in Search');
    expect(markup).toContain('Go to Search');
    expect(markup).not.toContain('Internet / month');
  });
});

describe('unavailable listing workspace', () => {
  it('keeps the find, saved, compare, and about tabs accessible', () => {
    const markup = renderToStaticMarkup(
      <UnavailableWorkspace
        hasActivePass={false}
        clearAllData={async () => undefined}
        refreshCurrent={() => undefined}
      >
        <main>
          <p>Current page cannot be inspected.</p>
        </main>
      </UnavailableWorkspace>,
    );

    expect(markup).toContain('Current page cannot be inspected.');
    expect(markup).toContain('>Search</button>');
    expect(markup).toContain('>Current</button>');
    expect(markup).not.toContain('>Ask</button>');
    expect(markup).not.toContain('Ask RentSight');
    expect(markup).toContain('>Saved (0)</button>');
    expect(markup).toContain('>Compare (0)</button>');
    expect(markup).toContain('>About</button>');
    expect(markup.match(/Load listing/g)).toHaveLength(1);
    expect(markup).not.toContain('Check again');
  });

  it('exposes Ask only when an active RentSight+ pass is confirmed', () => {
    const markup = renderToStaticMarkup(
      <UnavailableWorkspace
        hasActivePass
        clearAllData={async () => undefined}
        refreshCurrent={() => undefined}
      >
        <main>Current page cannot be inspected.</main>
      </UnavailableWorkspace>,
    );

    expect(markup).toContain('>Ask</button>');
    expect(markup).toContain('Ask RentSight');
  });

  it('provides household details and an accessible rental search form', () => {
    const markup = renderToStaticMarkup(<FindRentalsView />);

    expect(markup).toContain('aria-labelledby="find-rentals-heading"');
    expect(markup).toContain('<h1 id="find-rentals-heading">Search setup</h1>');
    expect(markup).toContain('id="search-household-heading"');
    expect(markup).toContain('Saved across sessions');
    expect(markup).toContain('Occupants');
    expect(markup).toContain('>Cats<');
    expect(markup).toContain('Small dogs');
    expect(markup).toContain('Large dogs');
    expect(markup).not.toContain('Internet / month');
    expect(markup).not.toContain('Pet-friendly filters');
    expect(markup).toContain('City, state or ZIP');
    expect(markup).toContain('Minimum listed rent');
    expect(markup).toContain('Parking available');
    expect(markup).toContain('Show rental sites');
    expect(markup).toContain('Clear search');
  });
});
