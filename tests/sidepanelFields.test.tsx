import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NumberField } from '../src/sidepanel/Fields';

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
