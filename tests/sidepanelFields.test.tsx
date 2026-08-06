import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NumberField } from '../src/sidepanel/Fields';
import { AnalysisEditor } from '../src/sidepanel/App';
import { analysisForNavigation } from '../src/sidepanel/navigationState';
import {
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
});

describe('analysis review workflow', () => {
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
    expect(markup.match(/class="review-disclosure"/g)).toHaveLength(4);
    expect(markup).toContain('<span>Utilities</span>');
    expect(markup).toContain('<span>Property expenses</span>');
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
});
