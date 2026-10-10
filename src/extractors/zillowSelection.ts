/** Stable identity for an explicitly opened Zillow apartment detail.
 * Keep navigation and extraction on the same route contract. A recognized
 * selection does not imply that its DOM has finished loading or is readable.
 */
export function zillowSelectedDetailRoute(url: URL): string | undefined {
  if (
    !/(^|\.)zillow\.com$/i.test(url.hostname) ||
    !/\/apartments\//i.test(url.pathname)
  )
    return undefined;
  const native = url.hash.match(/^#((?:uap|udp)-[\w/-]+)$/i)?.[1];
  if (native) return native;
  const synthetic = url.hash.match(/^#rentsight-unit=(.+)$/i)?.[1];
  if (!synthetic) return undefined;
  try {
    return decodeURIComponent(synthetic);
  } catch {
    return undefined;
  }
}
