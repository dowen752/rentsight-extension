/** Bounded property evidence shared by fee extraction and source capture. */
export const FEE_NOISE =
  'script,style,noscript,template,nav,header,footer,aside,form,input,textarea,select,iframe,svg,[hidden],[aria-hidden="true"],[style*="display:none"],[style*="display: none"],[data-testid="rdc-property-card"],[data-testid="property-card"],[class*="recommend" i],[class*="similar-list" i],[id^="div-gpt-ad"]';
export const feeLike =
  /\b(fees?|charges?|deposits?|penalty|pet rent|parking|garage|carport|resident (?:services?|benefits)|service package|valet trash|pest control|(?:first|last|1st) month(?:'s)? rent)\b/i;
// An amenity name identifies a possible category, not a payment obligation.
export const hasChargeLanguage = (text: string) =>
  /\b(fees?|charges?|deposits?|penalt(?:y|ies)|pet rent|required|mandatory|costs?|priced?|paid|payable|billed|billing)\b/i.test(
    text,
  );
export const cleanFeeText = (text: string) => text.replace(/\s+/g, ' ').trim();
export function feeRoot(document: Document): Element {
  return (
    document.querySelector('#left-column-container') ??
    document.querySelector('main, [role="main"]') ??
    document.body
  );
}
export function feeText(node: Node | null | undefined): string {
  if (!node) return '';
  const parts: string[] = [];
  const visit = (n: Node) => {
    if (n.nodeType === 3) {
      if (n.textContent?.trim()) parts.push(n.textContent.trim());
    } else if (n.nodeType === 1 && !(n as Element).matches(FEE_NOISE)) {
      if ((n as Element).tagName === 'BR') parts.push(';');
      else for (const child of n.childNodes) visit(child);
    }
  };
  visit(node);
  return cleanFeeText(parts.join(' '));
}
export function feeContext(element: Element, root: Element): string {
  const parts: string[] = [];
  let branch = element;
  for (let depth = 0; branch.parentElement && depth < 8; depth++) {
    const parent = branch.parentElement;
    const siblings = [...parent.children];
    const previous = siblings
      .slice(0, siblings.indexOf(branch))
      .reverse()
      .find(
        (n) =>
          /^H[1-6]$/.test(n.tagName) ||
          /^(?:Required|Optional|Monthly costs|Application costs|Move[- ]in costs)$/i.test(
            feeText(n),
          ),
      );
    parts.unshift(
      [
        parent.id,
        parent.className,
        parent.getAttribute('aria-label'),
        previous ? feeText(previous) : '',
      ]
        .filter(Boolean)
        .join(' '),
    );
    branch = parent;
    if (parent === root) break;
  }
  return parts.join(' ');
}
export interface FeeRow {
  element: Element;
  text: string;
  labelText?: string;
  amountText?: string;
  context: string;
  structured: boolean;
}
export function readFeeRows(document: Document): FeeRow[] {
  const root = feeRoot(document);
  const rows: FeeRow[] = [];
  const consumed = new Set<Element>();
  const add = (
    element: Element,
    labelText?: string,
    amountText?: string,
    structured = false,
  ) => {
    if (element.closest(FEE_NOISE)) return;
    const text = feeText(element);
    if (!text || text.length > 2000 || !feeLike.test(labelText ?? text)) return;
    rows.push({
      element,
      text,
      labelText,
      amountText,
      context: feeContext(element, root),
      structured,
    });
    consumed.add(element);
  };
  for (const element of root.querySelectorAll(
    '.fee-row, tbody tr, table > tr, [role="row"]',
  )) {
    if (
      element.querySelector('.fee-row, tr, [role="row"]') ||
      element.closest('thead')
    )
      continue;
    const cells = [
      ...element.querySelectorAll(
        ':scope > td, :scope > th, :scope > [role="cell"]',
      ),
    ];
    const total = element.querySelector(
      '[data-testid="fee-total"], [data-test-id="fee-total"], .fee-total',
    );
    add(
      element,
      cells.length
        ? feeText(cells[0])
        : element.firstElementChild && element.firstElementChild !== total
          ? feeText(element.firstElementChild)
          : undefined,
      total ? feeText(total) : cells.length > 1 ? feeText(cells[1]) : undefined,
      true,
    );
  }
  for (const dt of root.querySelectorAll('dt')) {
    const dd = dt.nextElementSibling;
    if (dd?.tagName !== 'DD' || dt.closest(FEE_NOISE)) continue;
    const labelText = feeText(dt);
    const amountText = feeText(dd);
    if (!feeLike.test(labelText)) continue;
    rows.push({
      element: dt,
      text: `${labelText}: ${amountText}`,
      labelText,
      amountText,
      context: feeContext(dt, root),
      structured: true,
    });
    consumed.add(dt);
    consumed.add(dd);
  }
  for (const element of root.querySelectorAll('article, section')) {
    if (
      element.querySelector('.fee-row, tr, dl, article, section, [role="row"]')
    )
      continue;
    const children = [...element.children];
    if (children.length !== 2) continue;
    const labelText = feeText(children[0]);
    const amountText = feeText(children[1]);
    if (
      !feeLike.test(labelText) ||
      !/^(?:\$|USD\b|[A-Z]{3}\s|free\b|included\b|varies\b)/i.test(amountText)
    )
      continue;
    add(element, labelText, amountText, true);
  }
  for (const element of root.querySelectorAll('p, li')) {
    if (
      element.closest('thead') ||
      [...consumed].some((row) => row === element || row.contains(element))
    )
      continue;
    if (element.querySelector('.fee-row,tr,p,li,dl,[role="row"]')) continue;
    add(element);
  }
  return rows;
}
