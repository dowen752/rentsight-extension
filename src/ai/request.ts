import { EXTRACTION_SCHEMA_VERSION } from './identity';
import type { ExtractionRequest } from './types';
import type { PageInfo } from '../shared/messages';

/** Build the normalized wire request shared by transport and developer export. */
export function buildExtractionRequest(
  page: PageInfo,
  requestId = crypto.randomUUID(),
): ExtractionRequest {
  if (!page.aiCapture) throw new Error('No extraction capture is available.');
  return structuredClone({
    schemaVersion: EXTRACTION_SCHEMA_VERSION,
    identity: {
      requestId,
      captureRevision: page.aiCapture.captureRevision,
      listingUrl: page.url,
      selectedUnit:
        page.selectedUnit ??
        (page.selectedUnitId
          ? { id: page.selectedUnitId, label: page.selectedUnitId }
          : null),
      selectedLeaseTermMonths: page.aiCapture.selectedLeaseTermMonths,
    },
    capture: page.aiCapture.capture,
    preliminaryValues: page.aiCapture.preliminaryValues,
  });
}

export function extractionCaptureFilename(request: ExtractionRequest): string {
  const url = new URL(request.identity.listingUrl);
  const stem =
    `${url.hostname}${decodeURIComponent(url.pathname)}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'listing';
  return `${stem}-extraction-capture-v${request.schemaVersion}.json`;
}

export function downloadExtractionCapture(page: PageInfo): void {
  const request = buildExtractionRequest(page);
  const blob = new Blob([`${JSON.stringify(request, null, 2)}\n`], {
    type: 'application/json',
  });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = extractionCaptureFilename(request);
  link.click();
  URL.revokeObjectURL(href);
}
