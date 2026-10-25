// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssistantView } from '../src/sidepanel/AssistantView';
import { extensionStorage } from '../src/storage';
import {
  applyCostProposal,
  type AssistantRequest,
  type AssistantProposal,
  type AssistantResponse,
} from '../src/assistant';
import { createInitialAnalysis } from '../src/shared/analysis';
import type { RentalSearch } from '../src/search';
import type { HouseholdProfile } from '../src/shared/household';

const initialHousehold: HouseholdProfile = {
  occupants: 1,
  cats: 0,
  smallDogs: 0,
  largeDogs: 0,
};
const delay = () => new Promise((resolve) => setTimeout(resolve, 5));
let container: HTMLDivElement;
let root: Root;
let storage: Map<string, unknown>;
let saveFails = false;
const navigate = vi.fn();
const openRentalSite = vi.fn<
  (siteId: string, search: RentalSearch) => Promise<{ automated: boolean }>
>(async () => ({ automated: true }));
let received: AssistantRequest[];
let responses: Array<AssistantProposal[]>;
async function sendMessage(
  request: AssistantRequest,
): Promise<AssistantResponse> {
  received.push(request);
  return {
    schemaVersion: '1.0',
    conversationId: 'conversation',
    messageId: `message-${received.length}`,
    contextRevision: request.contextRevision,
    message: { format: 'markdown', text: 'Review these suggested changes.' },
    proposals: responses.shift() ?? [],
  };
}
function Harness() {
  const [household, setHousehold] = useState(initialHousehold);
  const [analysis, setAnalysis] = useState(
    createInitialAnalysis('https://example.com/current'),
  );
  return (
    <AssistantView
      analysis={analysis}
      savedListings={[]}
      householdProfile={household}
      navigate={navigate}
      openRentalSite={openRentalSite}
      updateHouseholdProfile={async (profile) => {
        await extensionStorage.set('householdProfile', profile);
        setHousehold(profile);
      }}
      updateAnalysis={(proposal) => {
        if (proposal.type === 'analysis.set_cost')
          setAnalysis((current) => applyCostProposal(current, proposal));
      }}
      sendMessage={sendMessage}
      animateResponses={false}
    />
  );
}
async function until(predicate: () => boolean) {
  for (let i = 0; i < 100 && !predicate(); i++)
    await act(async () => {
      await delay();
    });
  expect(predicate()).toBe(true);
}
async function ask(message = 'Update my preferences') {
  await act(async () => {
    const input = container.querySelector('textarea')!;
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    )!.set!.call(input, message);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const prior = received.length;
  await act(async () => {
    container
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await until(
    () =>
      received.length > prior && !container.textContent?.includes('Thinking…'),
  );
}
async function click(label: string) {
  const button = [...container.querySelectorAll('button')].find(
    (item) => item.textContent === label,
  );
  expect(button, label).toBeDefined();
  await act(async () => {
    button!.click();
  });
  await until(() => !container.textContent?.includes('Working…'));
}

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  received = [];
  responses = [];
  saveFails = false;
  navigate.mockClear();
  openRentalSite.mockClear();
  storage = new Map([
    ['householdProfile', initialHousehold],
    [
      'searchProfile',
      {
        schemaVersion: 2,
        search: { location: 'Cupertino', maxListedRent: 3700 },
      },
    ],
  ] as Array<[string, unknown]>);
  vi.spyOn(extensionStorage, 'get').mockImplementation(
    async (key) => storage.get(key) as never,
  );
  vi.spyOn(extensionStorage, 'set').mockImplementation(async (key, value) => {
    if (saveFails && ['householdProfile', 'searchProfile'].includes(key))
      throw new Error('Storage unavailable');
    storage.set(key, value);
  });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<Harness />);
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe('Search/household approval experience', () => {
  it('saves household and preferences independently, then opens a site using derived pet flags', async () => {
    responses.push([
      {
        id: 'household-1',
        type: 'household.patch',
        explanation: 'Two occupants and one cat.',
        arguments: { set: { occupants: 2, cats: 1 } },
      },
      {
        id: 'search-1',
        type: 'search.patch',
        explanation: 'Set the listed-rent limit.',
        arguments: { set: { maxListedRent: 3200 }, clear: [] },
      },
    ]);
    await ask();
    expect(received[0].context).toMatchObject({
      household: initialHousehold,
      search: { location: 'Cupertino', maxListedRent: 3700 },
    });
    expect(received[0].capabilities.actions).toMatchObject({
      'household.patch': '1.0',
      'search.patch': '2.0',
      'search.launch': '2.0',
    });
    expect(container.textContent).toContain('Occupants: 1 → 2');
    await click('Update household');
    await click('Save search preferences');
    expect(storage.get('householdProfile')).toEqual({
      ...initialHousehold,
      occupants: 2,
      cats: 1,
    });
    expect(storage.get('searchProfile')).toEqual({
      schemaVersion: 2,
      search: { location: 'Cupertino', maxListedRent: 3200 },
    });
    expect(openRentalSite).not.toHaveBeenCalled();
    responses.push([
      {
        id: 'site-1',
        type: 'search.launch',
        explanation: 'Open Zillow.',
        arguments: { siteIds: ['zillow'] },
      },
    ]);
    await ask('Open Zillow');
    expect(container.textContent).toContain('check on site:');
    await click('Open rental site');
    expect(openRentalSite).toHaveBeenCalledWith('zillow', {
      location: 'Cupertino',
      maxListedRent: 3200,
      catsAllowed: true,
    });
    expect(openRentalSite.mock.calls[0][1]).not.toHaveProperty('occupants');
  });
  it('never reports failed saves as applied', async () => {
    responses.push([
      {
        id: 'failed-household',
        type: 'household.patch',
        explanation: 'Change counts.',
        arguments: { set: { cats: 1 } },
      },
    ]);
    await ask();
    saveFails = true;
    await click('Update household');
    expect(container.textContent).toContain('Failed');
    expect(container.textContent).not.toContain('Applied');
    expect(storage.get('householdProfile')).toEqual(initialHousehold);
  });
  it('rejects a search edit after the same stored field changes externally', async () => {
    responses.push([
      {
        id: 'stale-search',
        type: 'search.patch',
        explanation: 'Change budget.',
        arguments: { set: { maxListedRent: 3200 }, clear: [] },
      },
    ]);
    await ask();
    storage.set('searchProfile', {
      schemaVersion: 2,
      search: { location: 'Cupertino', maxListedRent: 3000 },
    });
    await click('Save search preferences');
    expect(container.textContent).toContain('Stale');
    expect(storage.get('searchProfile')).toMatchObject({
      search: { maxListedRent: 3000 },
    });
  });
  it('applies multiple independent cost edits from one answer without staling siblings', async () => {
    responses.push(
      ['electricity', 'water'].map((category) => ({
        id: `cost-${category}`,
        type: 'analysis.set_cost',
        explanation: `Change ${category}.`,
        arguments: {
          category,
          amount: 100,
          currency: 'USD',
          frequency: 'monthly',
        },
      })) as AssistantProposal[],
    );
    await ask('Set electricity and water to $100 each');
    await click('Apply');
    await click('Apply');
    expect(
      container.querySelectorAll('.assistant-proposal-status.applied'),
    ).toHaveLength(2);
    await ask('Explain my inputs');
    expect(received[1].context?.currentCalculation).toMatchObject({
      recurring: { electricity: { value: 100 }, water: { value: 100 } },
    });
  });
  it('clears Search preferences without clearing the household', async () => {
    responses.push([
      {
        id: 'clear-search',
        type: 'search.patch',
        explanation: 'Clear preferences.',
        arguments: { set: {}, clear: ['location', 'maxListedRent'] },
      },
    ]);
    await ask('Clear Search');
    await click('Save search preferences');
    expect(storage.get('searchProfile')).toEqual({
      schemaVersion: 2,
      search: {},
    });
    expect(storage.get('householdProfile')).toEqual(initialHousehold);
  });
});
