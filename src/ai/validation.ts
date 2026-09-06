import validateRequest from './contracts/request.validator.js';
import validateResponse from './contracts/response.validator.js';
import type { ExtractionRequest, ExtractionResponse } from './types';

export const sameIdentity = (
  a: ExtractionRequest['identity'],
  b: ExtractionRequest['identity'],
) =>
  a.requestId === b.requestId &&
  a.captureRevision === b.captureRevision &&
  a.listingUrl === b.listingUrl &&
  a.selectedLeaseTermMonths === b.selectedLeaseTermMonths &&
  a.selectedUnit?.id === b.selectedUnit?.id &&
  a.selectedUnit?.label === b.selectedUnit?.label &&
  (a.selectedUnit === null) === (b.selectedUnit === null);

export function assertRequest(request: ExtractionRequest): void {
  const paths = request.preliminaryValues.map((hint) => hint.fieldPath);
  const allowed = new Set(
    [
      'propertyName',
      'streetAddress',
      'city',
      'region',
      'postalCode',
      'country',
      'unitLabel',
      'bedrooms',
      'bathrooms',
      'floorArea',
      'baseRent',
      'fees',
      'utilities',
      'leaseTerm',
      'availableOn',
      'promotions',
    ].map((key) => `/property/${key}`),
  );
  if (
    !validateRequest(request) ||
    new TextEncoder().encode(JSON.stringify(request)).length > 512 * 1024 ||
    request.capture.blocks.reduce(
      (sum, block) => sum + Array.from(block.text).length,
      0,
    ) > 200000 ||
    new Set(request.capture.blocks.map((block) => block.id)).size !==
      request.capture.blocks.length ||
    new Set(paths).size !== paths.length ||
    paths.some((path) => !allowed.has(path)) ||
    request.preliminaryValues.some(
      (hint) =>
        new TextEncoder().encode(JSON.stringify(hint.value)).length > 16 * 1024,
    ) ||
    !Number.isFinite(Date.parse(request.capture.capturedAt))
  )
    throw new Error(
      'The listing capture is too large or invalid. Refresh the listing and try again.',
    );
}

const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const fail = (): never => {
  throw new Error(
    'The AI extraction response could not be verified. Preliminary values have been kept.',
  );
};

export function acceptResponse(
  value: unknown,
  request: ExtractionRequest,
): ExtractionResponse {
  if (!validateResponse(value)) return fail();
  const response = value as ExtractionResponse;
  if (response.identity && !sameIdentity(response.identity, request.identity))
    return fail();
  if (response.status === 'failed') {
    if (
      response.error.retryable !== (response.error.retryMode !== 'none') ||
      (response.error.retryAfterSeconds !== null &&
        (!Number.isFinite(response.error.retryAfterSeconds) ||
          response.error.retryAfterSeconds < 0))
    )
      return fail();
    return response;
  }
  if (
    response.metadata.capturedAt !== request.capture.capturedAt ||
    !/^[a-f0-9]{64}$/.test(response.metadata.captureSha256) ||
    !Number.isFinite(Date.parse(response.metadata.completedAt))
  )
    return fail();
  const { result } = response;
  for (const field of [result.property.bedrooms, result.property.bathrooms]) {
    for (const amount of [field.value, ...field.candidates])
      if (amount !== null && (!Number.isFinite(amount) || amount < 0))
        return fail();
  }
  const validDate = (date: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date;
  const dates = [
    result.property.availableOn,
    ...(result.property.promotions.value ?? []).flatMap((promotion) => [
      promotion.applyBy,
      promotion.moveInBy,
    ]),
  ];
  for (const field of dates)
    for (const date of [field.value, ...field.candidates])
      if (date !== null && !validDate(date)) return fail();
  const evidence = new Set(result.evidence.map((e) => e.id));
  if (evidence.size !== result.evidence.length) return fail();
  for (const item of result.evidence) {
    if (
      !item.quote.trim() ||
      !request.capture.blocks
        .find((block) => block.id === item.blockId)
        ?.text.includes(item.quote)
    )
      return fail();
  }
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      const ids = node
        .filter(object)
        .filter((item) => 'id' in item)
        .map((item) => item.id);
      if (new Set(ids).size !== ids.length) fail();
      node.forEach(visit);
      return;
    }
    if (!object(node)) return;
    if (
      Array.isArray(node.evidenceIds) &&
      node.evidenceIds.some((id) => !evidence.has(String(id)))
    )
      fail();
    if ('scope' in node && 'status' in node) {
      const candidates = node.candidates as unknown[];
      const refs = node.evidenceIds as string[];
      if (
        node.status === 'known' &&
        (node.value === null || candidates.length || !refs.length)
      )
        fail();
      if (
        (node.status === 'unknown' || node.status === 'not_applicable') &&
        (node.value !== null || candidates.length)
      )
        fail();
      if (node.status === 'not_applicable' && !refs.length) fail();
      if (
        node.status === 'conflict' &&
        (node.value !== null ||
          new Set(candidates.map((item) => JSON.stringify(item))).size < 2 ||
          !refs.length)
      )
        fail();
    }
    if (node.kind === 'conditional' && !(node.conditions as unknown[])?.length)
      fail();
    if ('minMinor' in node || ('min' in node && 'max' in node)) {
      const money = 'minMinor' in node;
      const min = (money ? node.minMinor : node.min) as number | null;
      const max = (money ? node.maxMinor : node.max) as number | null;
      for (const bound of [min, max])
        if (
          bound !== null &&
          (!Number.isFinite(bound) ||
            bound < 0 ||
            (money && !Number.isSafeInteger(bound)))
        )
          fail();
      if (node.kind === 'exact' && (min === null || min !== max)) fail();
      if (
        node.kind === 'range' &&
        ((min === null && max === null) ||
          (min !== null && max !== null && min >= max))
      )
        fail();
      if (money && !/^[A-Z]{3}$/.test(String(node.currency))) fail();
      if (
        ['months', 'weeks', 'days'].includes(String(node.unit)) &&
        [min, max].some((bound) => bound !== null && bound <= 0)
      )
        fail();
    }
    Object.values(node).forEach(visit);
  };
  visit(result);
  for (const item of [...result.notes, ...result.reviewIssues])
    for (const path of item.fieldPaths) {
      if (!path.startsWith('/property/')) fail();
      let target: unknown = result;
      for (const key of path
        .slice(1)
        .split('/')
        .map((key) => key.replace(/~1/g, '/').replace(/~0/g, '~'))) {
        if (
          (!object(target) && !Array.isArray(target)) ||
          !Object.hasOwn(target, key)
        )
          fail();
        target = (target as Record<string, unknown>)[key];
      }
    }
  return response;
}
