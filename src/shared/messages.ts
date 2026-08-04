import type { ListingExtraction } from '../extractors';

export interface PageInfo {
  url: string;
  title: string;
  appearsToBeRentalListing: boolean;
  extraction?: ListingExtraction;
}

export interface GetPageInfoMessage {
  type: 'GET_PAGE_INFO';
}

export interface PageInfoResponseMessage {
  type: 'PAGE_INFO_RESPONSE';
  payload: PageInfo;
}

export interface ExtensionErrorMessage {
  type: 'EXTENSION_ERROR';
  error: string;
}

export interface ExtractionUpdatedMessage {
  type: 'EXTRACTION_UPDATED';
  payload: PageInfo;
}

export type ExtensionRequest = GetPageInfoMessage;
export type ExtensionResponse = PageInfoResponseMessage | ExtensionErrorMessage;
export type ExtensionEvent = ExtractionUpdatedMessage;

export const isExtractionUpdatedMessage = (
  value: unknown,
): value is ExtractionUpdatedMessage =>
  typeof value === 'object' &&
  value !== null &&
  'type' in value &&
  value.type === 'EXTRACTION_UPDATED';

export const isExtensionRequest = (
  value: unknown,
): value is ExtensionRequest => {
  if (typeof value !== 'object' || value === null) return false;
  return 'type' in value && value.type === 'GET_PAGE_INFO';
};
