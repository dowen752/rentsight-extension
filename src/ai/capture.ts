import type { ListingExtraction } from '../extractors';
import type { Capture, CaptureContext } from './types';

// Content is frozen before transport. No user overrides or arbitrary form inputs.
export function captureListing(
  document: Document,
  extraction: ListingExtraction,
): CaptureContext {
  const capture: Capture = {
    capturedAt: new Date().toISOString(),
    truncated: false,
    unavailableSections: [],
    blocks: [],
  };
  let bytes = 0;
  let characters = 0;
  const encoder = new TextEncoder();
  const add = (
    kind: Capture['blocks'][number]['kind'],
    text: string,
    sectionPath: string[],
  ) => {
    if (!text.trim()) return;
    const block = {
      id: `block-${capture.blocks.length + 1}`,
      kind,
      sectionPath: [...sectionPath],
      text,
    };
    const size = encoder.encode(JSON.stringify(block)).length;
    if (
      capture.blocks.length >= 190 ||
      characters + Array.from(text).length > 180000 ||
      bytes + size > 450000
    ) {
      capture.truncated = true;
      return;
    }
    capture.blocks.push(block);
    bytes += size;
    characters += Array.from(text).length;
  };
  const selectedLeaseTermMonths = readSelectedLeaseTermMonths(document);
  for (const section of document.querySelectorAll('[aria-expanded="false"]')) {
    const label = section.textContent?.trim() ?? '';
    if (/fees|utilities|lease|promotion|pricing/i.test(label))
      capture.unavailableSections.push(
        `Collapsed section: ${label.slice(0, 100)}`,
      );
  }
  // Preserve non-executable JSON-LD before scripts are removed.
  for (const script of document.querySelectorAll(
    'script[type="application/ld+json"]',
  )) {
    try {
      add('json_ld', JSON.stringify(JSON.parse(script.textContent ?? '')), [
        'Structured listing data',
      ]);
    } catch {
      capture.unavailableSections.push('Unreadable JSON-LD');
    }
  }
  const root = (
    document.querySelector('main, [role="main"]') ?? document.body
  ).cloneNode(true) as HTMLElement;
  root
    .querySelectorAll(
      'script,style,noscript,template,nav,form,input,textarea,select,button,iframe,[style*="display:none"],[style*="display: none"],[hidden],[aria-hidden="true"],[contenteditable], [role="navigation"], [class*="recommend" i], [class*="similar-list" i], [class*="advertisement" i]',
    )
    .forEach((node) => node.remove());
  const headings: string[] = [];
  // Walk once so custom div-based sites are captured without duplicating parents.
  const walk = (element: Element) => {
    if (/^H[1-6]$/.test(element.tagName)) {
      const title = element.textContent?.trim() ?? '';
      const level = Number(element.tagName[1]);
      headings.splice(level - 1);
      headings[level - 1] = title;
      add('heading', title, headings.filter(Boolean));
      return;
    }
    if (element.tagName === 'TABLE') {
      const rows = Array.from(element.querySelectorAll('tr')).map(
        (row) =>
          '| ' +
          Array.from(row.querySelectorAll('th,td'))
            .map((cell) => cell.textContent?.trim().replace(/\s+/g, ' ') ?? '')
            .join(' | ') +
          ' |',
      );
      add('table', rows.join('\n'), headings.filter(Boolean));
      return;
    }
    const atomic =
      ['P', 'LI', 'DD', 'DT', 'SMALL'].includes(element.tagName) ||
      element.children.length === 0;
    if (atomic) {
      add(
        element.tagName === 'SMALL' ? 'footnote' : 'paragraph',
        element.textContent?.trim() ?? '',
        headings.filter(Boolean),
      );
      return;
    }
    for (const child of element.childNodes) {
      if (child.nodeType === 3)
        add('other', child.textContent?.trim() ?? '', headings.filter(Boolean));
      else if (child.nodeType === 1) walk(child as Element);
    }
  };
  walk(root);
  for (const section of ['pricing', 'fees', 'utilities', 'lease']) {
    const pattern = {
      pricing: /rent|price|pricing/i,
      fees: /fee|deposit/i,
      utilities: /utilit|electric|water|gas|internet/i,
      lease: /lease|promotion|concession/i,
    }[section]!;
    if (!capture.blocks.some((block) => pattern.test(block.text)))
      capture.unavailableSections.push(`${section} not found in capture`);
  }
  const preliminaryValues: CaptureContext['preliminaryValues'] = [];
  const { identity, recurring, concessions } = extraction.listing;
  const hints = {
    propertyName: identity.listingTitle,
    streetAddress: identity.fullAddress,
    city: identity.city,
    region: identity.state,
    postalCode: identity.zipCode,
    bedrooms: identity.bedrooms,
    bathrooms: identity.bathrooms,
    floorArea: identity.squareFootage,
    baseRent: recurring.advertisedRent,
    leaseTerm: concessions?.leaseMonths,
  };
  for (const [key, field] of Object.entries(hints)) {
    if (field?.source === 'listing')
      preliminaryValues.push({
        fieldPath: `/property/${key}`,
        value: field.value,
      });
  }
  return {
    capture,
    preliminaryValues,
    captureRevision: Array.from(
      crypto.getRandomValues(new Uint32Array(4)),
    ).join('-'),
    selectedLeaseTermMonths,
  };
}

export function readSelectedLeaseTermMonths(document: Document): number | null {
  let selectedLeaseTermMonths: number | null = null;
  for (const select of document.querySelectorAll('select')) {
    const label = [
      select.getAttribute('aria-label'),
      ...Array.from(select.labels ?? []).map((label) => label.textContent),
    ].join(' ');
    if (!/lease|lease term|lease duration/i.test(label)) continue;
    const selected = select.selectedOptions[0]?.textContent?.match(
      /\b(\d+(?:\.\d+)?)\s*months?\b/i,
    );
    if (selected && Number(selected[1]) > 0)
      selectedLeaseTermMonths = Number(selected[1]);
  }
  return selectedLeaseTermMonths;
}
