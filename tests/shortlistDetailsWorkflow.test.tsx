// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComparisonView, SavedListingsView } from '../src/sidepanel/App';
import { AiSourceReview } from '../src/sidepanel/AiExtractionCard';
import {
  createInitialAnalysis,
  applyExtraction,
  setRecurringValue,
} from '../src/shared/analysis';
import { extractListing } from '../src/extractors';
import {
  saveListing,
  exportListingsJson,
  importListingsJson,
} from '../src/saved';

const household = { occupants: 1, cats: 0, smallDogs: 0, largeDogs: 0 };

describe('shortlist details workflow', () => {
  let container: HTMLDivElement;
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
  });
  afterEach(() => {
    container.remove();
    vi.unstubAllGlobals();
  });

  it('keeps selection controls outside the expanded full-width transfer panel', async () => {
    const root = createRoot(container);
    const records = saveListing(
      [],
      createInitialAnalysis('https://example.com/rental'),
    ).records;
    function Saved() {
      const [selected, setSelected] = useState<string[]>([]);
      return (
        <SavedListingsView
          records={records}
          householdProfile={household}
          selected={selected}
          setSelected={setSelected}
          setRecords={vi.fn()}
          setNotice={vi.fn()}
          onDelete={vi.fn()}
          openCompare={vi.fn()}
        />
      );
    }
    await act(async () => root.render(<Saved />));
    const more = container.querySelector<HTMLButtonElement>(
      '.collection-more-toggle',
    )!;
    const panel = container.querySelector<HTMLDivElement>(
      '.collection-more-options',
    )!;
    expect(panel.hidden).toBe(true);
    await act(async () => more.click());
    expect(panel.hidden).toBe(false);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    const selectAll = container.querySelector<HTMLButtonElement>(
      '.collection-select-all',
    )!;
    expect(selectAll.parentElement).toBe(panel.parentElement);
    await act(async () => selectAll.click());
    expect(
      container.querySelector<HTMLInputElement>('.saved-select input')!.checked,
    ).toBe(true);
    expect(panel.textContent).toContain('Download selected backup');
    await act(async () => more.click());
    expect(panel.hidden).toBe(true);
    await act(async () => root.unmount());
  });

  it('expands a shortened comparison note after saving and restoring without losing text', async () => {
    const text =
      'Special security deposit offer: '.repeat(10) +
      'Applies only to a qualifying twelve-month lease.';
    const analysis = setRecurringValue(
      createInitialAnalysis('https://example.com/one'),
      'advertisedRent',
      2000,
    );
    analysis.propertyNotes.push({ id: 'long', source: 'user', text });
    analysis.propertyNotes.push({
      id: 'short',
      source: 'user',
      text: 'Covered parking available.',
    });
    const saved = saveListing([], analysis).records;
    const records = importListingsJson(exportListingsJson(saved)).records;
    records.push(
      saveListing(
        [],
        setRecurringValue(
          createInitialAnalysis('https://example.com/two'),
          'advertisedRent',
          2100,
        ),
      ).record,
    );
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <ComparisonView records={records} householdProfile={household} />,
      ),
    );
    const toggle = container.querySelector<HTMLButtonElement>(
      '.comparison-note-toggle',
    )!;
    const note = toggle.parentElement!;
    expect(note.textContent!.length).toBeLessThan(130);
    expect(container.querySelectorAll('.comparison-note-toggle')).toHaveLength(
      1,
    );
    await act(async () => toggle.click());
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(note.textContent).toContain(text);
    await act(async () => toggle.click());
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(note.textContent).not.toContain('qualifying twelve-month lease');
    expect(records[0].analysis.propertyNotes[0].text).toBe(text);
    await act(async () => root.unmount());
  });

  it('keeps overflow suggestions reviewable and persists Keep and Dismiss decisions', async () => {
    const url = 'https://example.com/fees';
    const dom = document.implementation.createHTMLDocument();
    dom.body.innerHTML =
      '<main>' +
      ['Storage', 'Parking', 'Service', 'Application', 'Pet']
        .map((label) => `<p>Optional ${label} fee: $25.</p>`)
        .join('') +
      '</main>';
    const initial = applyExtraction(
      createInitialAnalysis(url),
      extractListing(dom, new URL(url)),
    );
    let latest = initial;
    function Review() {
      const [analysis, setAnalysis] = useState(initial);
      latest = analysis;
      return <AiSourceReview analysis={analysis} update={setAnalysis} />;
    }
    const root = createRoot(container);
    await act(async () => root.render(<Review />));
    const details =
      container.querySelector<HTMLDetailsElement>('.ai-charge-more')!;
    expect(details.open).toBe(false);
    expect(
      container.querySelectorAll('.ai-extraction-flags > .ai-charge'),
    ).toHaveLength(3);
    await act(async () => details.querySelector('summary')!.click());
    expect(details.open).toBe(true);
    await act(async () =>
      details.querySelector<HTMLInputElement>('input')!.click(),
    );
    expect(latest.propertyNotes).toHaveLength(1);
    const restored = importListingsJson(
      exportListingsJson(saveListing([], latest).records),
    ).records[0];
    expect(restored.analysis.propertyNotes).toEqual(latest.propertyNotes);
    const dismissed = details.querySelector<HTMLButtonElement>('button')!;
    await act(async () => dismissed.click());
    expect(latest.propertyNotes).toHaveLength(0);
    expect(Object.values(latest.aiReviewDecisions!)).toContain('excluded');
    await act(async () => root.unmount());
  });
});
