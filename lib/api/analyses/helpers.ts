/** Lowercase, trim, and collapse whitespace runs to a single space. */
export function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}
