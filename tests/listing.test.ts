import { describe, expect, it } from 'vitest';
import { appearsToBeRentalListing } from '../src/shared/listing';

describe('appearsToBeRentalListing', () => {
  it('recognizes rental language in a page title', () => {
    expect(
      appearsToBeRentalListing(
        'https://example.com/home/12',
        'Apartment for rent',
      ),
    ).toBe(true);
  });

  it('recognizes a rental URL path', () => {
    expect(
      appearsToBeRentalListing('https://example.com/rentals/12', 'Lovely home'),
    ).toBe(true);
  });

  it('does not label an unrelated page as a rental', () => {
    expect(
      appearsToBeRentalListing('https://example.com/news', 'Local news'),
    ).toBe(false);
  });
});
