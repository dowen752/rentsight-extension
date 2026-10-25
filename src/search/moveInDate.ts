/** Explain an unsuccessful transfer without replacing the renter's saved date. */
export function moveInDateFailureMessage(site: string, date: string): string {
  const today = new Date();
  const localToday = [
    String(today.getFullYear()).padStart(4, '0'),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  return date < localToday
    ? `${site} opened and applied the available filters, but your move-in date is in the past. Choose a future date in RentSight and try again. Review any remaining preferences on site.`
    : `${site} opened and applied the available filters, but could not apply your move-in date. Choose an available date in the site's calendar and review any remaining preferences before browsing.`;
}
