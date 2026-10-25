// Realtor can show a listing in an overlay while search results remain mounted.
// Share this scope between deterministic extraction and the AI evidence capture.
export const REALTOR_NOISE =
  '[data-testid="rdc-property-card"], [data-testid="property-card"], [data-testid="list-price-reduction"], [data-testid="affordable-home-price"], [id^="div-gpt-ad"], [class*="recommend" i], [class*="similar-list" i], form, input, textarea, select, script, style, [hidden], [aria-hidden="true"], [style*="display: none"], [style*="display:none"]';

export const REALTOR_FEE_CARDS =
  '[data-testid="monthly-fees-card"], [data-testid="move-in-fees-card"], [data-testid="additional-fees-card"]';

export function realtorListingRoot(document: Document): Element {
  return (
    document.querySelector('#left-column-container') ??
    document.querySelector('main, [role="main"]') ??
    document.body
  );
}

export function listingText(element: Node | null | undefined): string {
  if (!element) return '';
  const parts: string[] = [];
  const visit = (node: Node) => {
    if (node.nodeType === 3) {
      if (node.textContent?.trim()) parts.push(node.textContent.trim());
    } else if (node.nodeType === 1) {
      if ((node as Element).matches(REALTOR_NOISE + ', button, svg, iframe'))
        return;
      for (const child of node.childNodes) visit(child);
    }
  };
  visit(element);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export interface RealtorFeeRow {
  element: Element;
  label: string;
  amountText: string;
  text: string;
  cadence: 'monthly' | 'one_time' | 'unknown';
  applicability: 'required' | 'optional' | 'unknown';
}

// Split fee lists without splitting currency thousands, decimal amounts, or
// qualifications inside parentheses. Each label keeps its own quoted amount.
export function splitFeeList(text: string): string[] {
  return text.split(/;|,(?=\s*[A-Za-z][^,$;]*:\s*\$)/).map((s) => s.trim());
}

export function realtorFeeRows(root: Element): RealtorFeeRow[] {
  const rows: RealtorFeeRow[] = [];
  for (const card of root.querySelectorAll(REALTOR_FEE_CARDS)) {
    if (card.closest(REALTOR_NOISE)) continue;
    const cadence =
      card.getAttribute('data-testid') === 'monthly-fees-card'
        ? 'monthly'
        : card.getAttribute('data-testid') === 'move-in-fees-card'
          ? 'one_time'
          : 'unknown';
    for (const group of card.children) {
      const heading = listingText(group.querySelector(':scope > p'));
      const applicability = /^Required$/i.test(heading)
        ? 'required'
        : /^Optional$/i.test(heading)
          ? 'optional'
          : 'unknown';
      for (const element of group.children) {
        if (element.tagName !== 'DIV' || element.children.length !== 2)
          continue;
        const label = listingText(element.children[0].querySelector('p'));
        const amountText = listingText(element.children[1]);
        if (
          !label ||
          !/^(?:\$|(?:USD|CAD|AUD|EUR|GBP)\b|up to|starting|from|varies|included|free|no charge)/i.test(
            amountText,
          )
        )
          continue;
        rows.push({
          element,
          label,
          amountText,
          text: listingText(element),
          cadence,
          applicability,
        });
      }
    }
  }
  for (const element of root.querySelectorAll('li, p')) {
    if (element.closest(REALTOR_NOISE + ', ' + REALTOR_FEE_CARDS)) continue;
    const text = listingText(element);
    const list = text.match(/^Monthly Fees:\s*(.+)$/i);
    if (!list) continue;
    for (const clause of splitFeeList(list[1])) {
      const match = clause.match(/^(.+?):\s*(.+)$/);
      if (!match) continue;
      rows.push({
        element,
        label: match[1].trim(),
        amountText: match[2],
        text: clause,
        cadence: 'monthly',
        applicability: /optional|if\b/i.test(clause) ? 'optional' : 'required',
      });
    }
  }
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = JSON.stringify([
      row.label,
      row.amountText,
      row.cadence,
      row.applicability,
    ]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
