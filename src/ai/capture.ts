import type { ListingExtraction } from '../extractors';
import type { Capture, CaptureContext } from './types';

const JSON_LD_NOISE_KEYS = new Set([
  'aggregaterating',
  'breadcrumb',
  'breadcrumbs',
  'image',
  'images',
  'logo',
  'photo',
  'photos',
  'review',
  'reviews',
  'sameas',
  'thumbnail',
  'thumbnailurl',
  'video',
  'videos',
]);

function pruneJsonLd(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(pruneJsonLd);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, child]) =>
      JSON_LD_NOISE_KEYS.has(key.toLowerCase())
        ? []
        : [[key, pruneJsonLd(child)]],
    ),
  );
}

const normalizedBlockText = (value: string) =>
  value
    .normalize('NFKC')
    .replace(
      /[\u058A\u05BE\u1400\u1806\u2010-\u2015\u2E17\u2E1A\u2E3A-\u2E3B\u2E40\u301C\u3030\u30A0\uFE31-\uFE32\uFE58\uFE63\uFF0D]/g,
      '-',
    )
    .replace(/\s+/g, ' ')
    .trim();

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
    capture.blocks.push(block);
  };
  const coalesceTextBlocks = () => {
    const grouped: Capture['blocks'] = [];
    for (const block of capture.blocks) {
      const previous = grouped.at(-1);
      const compatible =
        previous &&
        previous.kind === 'other' &&
        block.kind === 'other' &&
        JSON.stringify(previous.sectionPath) ===
          JSON.stringify(block.sectionPath) &&
        previous.text.length + block.text.length + 1 <= 4_000;
      if (compatible) previous.text += `\n${block.text}`;
      else grouped.push({ ...block });
    }
    capture.blocks = grouped.map((block, index) => ({
      ...block,
      id: `block-${index + 1}`,
    }));
  };
  const deduplicateBlocks = () => {
    const seen = new Set<string>();
    capture.blocks = capture.blocks.filter((block) => {
      const key = JSON.stringify([
        block.kind,
        block.sectionPath.map(normalizedBlockText),
        normalizedBlockText(block.text),
      ]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const enforceCaptureLimits = () => {
    const retained: Capture['blocks'] = [];
    let bytes = 0;
    let characters = 0;
    for (const block of capture.blocks) {
      const size = encoder.encode(JSON.stringify(block)).length;
      const textCharacters = Array.from(block.text).length;
      if (
        retained.length >= 190 ||
        characters + textCharacters > 180000 ||
        bytes + size > 450000
      ) {
        capture.truncated = true;
        continue;
      }
      retained.push(block);
      bytes += size;
      characters += textCharacters;
    }
    capture.blocks = retained;
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
      add(
        'json_ld',
        JSON.stringify(pruneJsonLd(JSON.parse(script.textContent ?? ''))),
        ['Structured listing data'],
      );
    } catch {
      capture.unavailableSections.push('Unreadable JSON-LD');
    }
  }
  const root = (
    document.querySelector('main, [role="main"]') ?? document.body
  ).cloneNode(true) as HTMLElement;
  root
    .querySelectorAll(
      'script,style,noscript,template,nav,header,footer,aside,form,input,textarea,select,button,iframe,svg,canvas,[style*="display:none"],[style*="display: none"],[hidden],[aria-hidden="true"],[contenteditable],[role="navigation"],[role="banner"],[role="contentinfo"],[role="complementary"],[role="search"],[class*="recommend" i],[class*="similar-list" i],[class*="advertisement" i],[class*="cookie" i],[id*="cookie" i],[class*="newsletter" i],[class*="social-share" i],[class*="share-widget" i],[class*="chat-widget" i],[class*="chatbot" i],[class*="survey-banner" i],[class*="app-banner" i]',
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
        element.tagName === 'SMALL'
          ? 'footnote'
          : ['P', 'LI', 'DD', 'DT'].includes(element.tagName)
            ? 'paragraph'
            : 'other',
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
  // Dynamic, div-heavy sites often render one fact across several adjacent leaf
  // nodes. Keep their exact text while giving the model a coherent evidence block.
  coalesceTextBlocks();
  deduplicateBlocks();
  enforceCaptureLimits();
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
