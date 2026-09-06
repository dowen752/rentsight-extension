import type { Issue } from '../ai/contracts/response';

const REVIEW_FIELD_LABELS = {
  '/property/propertyName': 'Listing name',
  '/property/address': 'Address',
  '/property/unitLabel': 'Unit',
  '/property/bedrooms': 'Bedrooms',
  '/property/bathrooms': 'Bathrooms',
  '/property/floorArea': 'Floor area',
  '/property/baseRent': 'Base rent',
  '/property/fees': 'Fees',
  '/property/utilities': 'Utilities',
  '/property/leaseTerm': 'Lease term',
  '/property/availableOn': 'Availability date',
  '/property/promotions': 'Promotions',
} as const;

function fieldLabel(path: string): string {
  for (const [fieldPath, label] of Object.entries(REVIEW_FIELD_LABELS)) {
    if (path === fieldPath || path.startsWith(`${fieldPath}/`)) return label;
  }
  return 'Listing detail';
}

function joinFieldLabels(labels: string[]): string {
  const sentenceLabels = labels.map((label, index) =>
    index === 0 ? label : `${label[0].toLocaleLowerCase()}${label.slice(1)}`,
  );
  if (sentenceLabels.length === 1) return sentenceLabels[0];
  if (sentenceLabels.length === 2) return sentenceLabels.join(' and ');
  return `${sentenceLabels.slice(0, -1).join(', ')}, and ${sentenceLabels.at(-1)}`;
}

export function formatReviewIssue(
  issue: Pick<Issue, 'fieldPaths' | 'message'>,
): string {
  const labels = [...new Set(issue.fieldPaths.map(fieldLabel))];
  return `${joinFieldLabels(labels.length ? labels : ['Listing detail'])}: ${issue.message}`;
}
