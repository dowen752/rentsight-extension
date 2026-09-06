import type { RentSightExtractionV1Request } from './contracts/request';
import type { RentSightExtractionV1Response } from './contracts/response';
export type ExtractionRequest = RentSightExtractionV1Request;
export type ExtractionResponse = RentSightExtractionV1Response;
export type ExtractionSuccess = Extract<
  ExtractionResponse,
  { status: 'succeeded' }
>;
export type ExtractionFailure = Extract<
  ExtractionResponse,
  { status: 'failed' }
>;
export type Capture = ExtractionRequest['capture'];
export type CaptureContext = Pick<
  ExtractionRequest,
  'capture' | 'preliminaryValues'
> & {
  captureRevision: string;
  selectedLeaseTermMonths: number | null;
};
