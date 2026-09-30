// SQLite's LIKE ignores case only for Latin letters: "молоко" does not match
// "Молоко", and lower()/upper() are ASCII-only as well, so the database cannot
// fold Cyrillic itself. A search term is therefore expanded into the spellings
// a name is realistically stored in — as typed, lower, UPPER, "Capitalised" and
// "Title-Case" (after spaces, hyphens and quotes) — and matched against each.

export function caseVariants(term: string): string[] {
  const lower = term.toLowerCase();
  const upper = term.toUpperCase();
  const capitalised = lower.charAt(0).toUpperCase() + lower.slice(1);
  const title = lower.replace(/(^|[\s\-«"(])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
  return Array.from(new Set([term, lower, upper, capitalised, title]));
}

// "молоко лактис" finds "Молоко «Лактис» 3,2%": every word must match somewhere,
// in any order. Capped so a pasted paragraph cannot build a monster query.
export function searchTokens(search: string, max = 5): string[] {
  return search.trim().split(/\s+/).filter(Boolean).slice(0, max);
}
