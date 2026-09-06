/* Generated from the shared v1 JSON schema. Run npm run contract:generate. */

export interface RentSightExtractionV1Request {
  schemaVersion: '1.1.0';
  identity: Identity;
  capture: {
    capturedAt: string;
    truncated: boolean;
    unavailableSections: string[];
    /**
     * @maxItems 200
     */
    blocks: {
      id: string;
      kind:
        'heading' | 'paragraph' | 'table' | 'json_ld' | 'footnote' | 'other';
      sectionPath: string[];
      text: string;
    }[];
  };
  /**
   * @maxItems 100
   */
  preliminaryValues: {
    fieldPath: string;
    value: unknown;
  }[];
}
export interface Identity {
  requestId: string;
  captureRevision: string;
  listingUrl: string;
  selectedUnit: {
    id: string | null;
    label: string;
  } | null;
  selectedLeaseTermMonths: number | null;
}
