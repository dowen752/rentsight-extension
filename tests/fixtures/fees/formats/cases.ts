export interface FeeFormatCase {
  id: string;
  title: string;
  url: string;
  gap?: string;
  gapAssertion?: 'notes';
}
const generic = 'https://example.com/rental/100-example-ave';
export const feeFormats: FeeFormatCase[] = [
  { id: 'prose', title: 'separate label-first paragraphs', url: generic },
  { id: 'amount-first', title: 'amount-first semicolon clauses', url: generic },
  {
    id: 'bullets',
    title: 'nested labels and amounts in bullet lists',
    url: generic,
  },
  {
    id: 'table',
    title: 'native table with cadence and applicability columns',
    url: generic,
  },
  {
    id: 'zillow-calculator',
    title: 'calculator with inherited groups and optional selection total zero',
    url: 'https://www.zillow.com/homedetails/example/1_zpid/',
  },
  {
    id: 'realtor-card',
    title: 'Realtor sibling label/value columns',
    url: 'https://www.realtor.com/rentals/details/100-Example-Ave',
  },
  {
    id: 'realtor-inline',
    title: 'Realtor comma-separated fee details',
    url: 'https://www.realtor.com/rentals/details/100-Example-Ave',
  },
  {
    id: 'whitespace',
    title: 'wrapped text and nonbreaking currency spaces',
    url: generic,
  },
  {
    id: 'currency-spaces',
    title: 'nonbreaking currency spaces and nested inline labels',
    url: generic,
  },
  {
    id: 'description-list',
    title: 'description-list label/value pairs',
    url: generic,
  },
  {
    id: 'aria-table',
    title: 'ARIA div table rows',
    url: generic,
  },
  {
    id: 'mobile-cards',
    title: 'mobile fee cards with section aria-labels',
    url: generic,
  },
  {
    id: 'sibling-paragraphs',
    title: 'labels and amounts in separate paragraphs',
    url: generic,
  },
  {
    id: 'inline-generic',
    title: 'generic comma-separated fee details',
    url: generic,
  },
  {
    id: 'usd-prefix',
    title: 'explicit USD currency code without dollar sign',
    url: generic,
  },
];
