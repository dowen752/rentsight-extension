import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assertRequest } from '../../src/ai/validation';
import {
  buildExtractionRequest,
  extractionCaptureFilename,
} from '../../src/ai/request';
import type { PageInfo } from '../../src/shared/messages';

const page: PageInfo = {
  url: 'https://example.com/listings/Pine%20Court?campaign=dev',
  title: 'Pine Court',
  appearsToBeRentalListing: true,
  selectedUnitId: '204',
  selectedUnit: { id: '204', label: 'Unit 204' },
  aiCapture: {
    captureRevision: 'capture-7',
    selectedLeaseTermMonths: 12,
    capture: {
      capturedAt: '2026-09-10T12:00:00.000Z',
      truncated: false,
      unavailableSections: [],
      blocks: [
        {
          id: 'block-1',
          kind: 'paragraph',
          sectionPath: ['Fees'],
          text: 'Application fee $55 per applicant.',
        },
      ],
    },
    preliminaryValues: [{ fieldPath: '/property/baseRent', value: 2400 }],
  },
};

describe('extraction capture export', () => {
  it('keeps the checked-in schema, generated type, and runtime contract on v1.1.0', () => {
    const schema = JSON.parse(
      readFileSync(
        new URL('../../src/ai/contracts/request.schema.json', import.meta.url),
        'utf8',
      ),
    );
    const generated = readFileSync(
      new URL('../../src/ai/contracts/request.ts', import.meta.url),
      'utf8',
    );
    expect(schema.$id).toBe('urn:rentsight:extraction:1.1.0:request');
    expect(schema.properties.schemaVersion.enum).toEqual(['1.1.0']);
    expect(generated).toContain("schemaVersion: '1.1.0'");
  });
  it('builds the schema-valid wire request without browser credentials', () => {
    const request = buildExtractionRequest(
      page,
      '11111111-1111-4111-8111-111111111111',
    );
    expect(() => assertRequest(request)).not.toThrow();
    expect(request.schemaVersion).toBe('1.1.0');
    expect(request.identity.selectedUnit).toEqual({
      id: '204',
      label: 'Unit 204',
    });
    expect(JSON.stringify(request)).not.toMatch(
      /authorization|firebase|cookie|stripe|token/i,
    );
  });

  it('uses a deterministic filesystem-safe suggested filename', () => {
    const request = buildExtractionRequest(
      page,
      '11111111-1111-4111-8111-111111111111',
    );
    expect(extractionCaptureFilename(request)).toBe(
      'example-com-listings-pine-court-extraction-capture-v1.1.0.json',
    );
  });
});
