// Strips Unicode combining diacritical marks (U+0300-U+036F) left behind after NFD normalization.
const COMBINING_DIACRITICAL_MARKS = /[\u0300-\u036f]/g;

/** Strips accents/non-letters, uppercases, and truncates — used to build readable driver/fleet ref prefixes. */
export function letters(str: string | null | undefined, len: number): string {
  return (str ?? '')
    .normalize('NFD')
    .replace(COMBINING_DIACRITICAL_MARKS, '')
    .replace(/[^a-zA-Z]/g, '')
    .slice(0, len)
    .toUpperCase();
}
