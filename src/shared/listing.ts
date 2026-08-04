const RENTAL_HINTS = [
  /\bfor rent\b/i,
  /\bmonthly rent\b/i,
  /\bapartment(s)?\b/i,
  /\brental(s)?\b/i,
  /\/rent(?:als?)?\b/i,
  /\/apartments?\b/i,
];

export function appearsToBeRentalListing(url: string, title: string): boolean {
  const pageDescription = `${url} ${title}`;
  return RENTAL_HINTS.some((hint) => hint.test(pageDescription));
}
