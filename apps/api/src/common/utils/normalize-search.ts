const COMBINING_DIACRITICAL_MARKS = /[̀-ͯ]/g;

/** Accent-insensitive, case-insensitive normalization for free-text search matching. */
export function normalizeSearch(str: string | null | undefined): string {
  return (str ?? '')
    .normalize('NFD')
    .replace(COMBINING_DIACRITICAL_MARKS, '')
    .toLowerCase();
}
