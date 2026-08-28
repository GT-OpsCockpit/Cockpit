/**
 * Single source of truth for "is this a plausible email address" — imported
 * by both the API (DTO validators, ClientsService) and the web forms so
 * format validation can't drift into accepting/rejecting different strings
 * on either side (e.g. class-validator's IsEmail vs zod's .email() use
 * different regexes and disagree on edge cases).
 *
 * Plain JS (not .ts) on purpose: this file is loaded three different ways —
 * raw by Vite (web), through ts-jest (api unit/e2e tests), and via Node's
 * own module resolution at api runtime (`nest start`/`node dist/main.js`,
 * where `@cockpit/shared` has no compiled output to point at). Node's native
 * loader needs a real, already-valid-JS file to find at the exact path a
 * relative import specifies — a `.ts` source file doesn't satisfy that
 * without a build step this package deliberately doesn't have.
 */

/**
 * The WHATWG/HTML5 `<input type="email">` pattern — the one browsers apply
 * natively, so the form never shows a field the browser calls valid and we
 * call invalid. Two deliberate tightenings over the raw HTML5 rule, applied
 * separately below rather than by editing the pattern (keeping it recognisable
 * as the spec's):
 *   - HTML5 accepts a bare hostname ("a@b"); a real address has a dot.
 *   - HTML5 accepts leading/trailing/doubled dots in the local part.
 */
const EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export function isValidEmail(value) {
  if (typeof value !== 'string') return false;
  if (!EMAIL_PATTERN.test(value)) return false;
  const [local, domain] = value.split('@');
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) {
    return false;
  }
  // A dot plus a 2+ letter TLD: rules out "a@b" and "a@b.c", both of which
  // the HTML5 pattern lets through.
  return /\.[a-zA-Z]{2,}$/.test(domain);
}

/** Trims + lowercases so "Foo@Bar.com" and "foo@bar.com" dedupe as the same address. */
export function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

/**
 * Domains typed wrong often enough to be worth catching. Not a whitelist —
 * an address on an unlisted domain is simply never corrected.
 */
const COMMON_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'hotmail.fr',
  'outlook.com',
  'outlook.fr',
  'live.com',
  'live.fr',
  'msn.com',
  'yahoo.com',
  'yahoo.fr',
  'icloud.com',
  'me.com',
  'free.fr',
  'orange.fr',
  'wanadoo.fr',
  'laposte.net',
  'sfr.fr',
  'bbox.fr',
  'numericable.fr',
  'aol.com',
  'protonmail.com',
  'proton.me',
];

/**
 * Damerau-Levenshtein (optimal string alignment), capped: anything past `max`
 * stops early. Damerau rather than plain Levenshtein because a transposition
 * — "gmial" for "gmail", "hotmial" for "hotmail" — is the single most common
 * way an address gets mistyped, and plain Levenshtein scores it 2 edits,
 * putting it out of reach of a distance-1 threshold.
 */
function distance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let twoBack = [];
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d = Math.min(d, twoBack[j - 2] + 1);
      }
      row[j] = d;
      if (d < best) best = d;
    }
    if (best > max) return max + 1;
    twoBack = prev;
    prev = row;
  }
  return prev[b.length];
}

/**
 * "romain@gmial.com" -> "romain@gmail.com", or null when the domain is either
 * already correct or too far from anything we know to guess safely.
 *
 * Purely a UI suggestion: it never rewrites a value on its own, because a
 * near-miss of a common domain can be a perfectly real address (gmail.co is
 * a live domain). The user clicks to accept.
 */
export function suggestEmailDomain(value) {
  if (typeof value !== 'string') return null;
  const normalized = normalizeEmail(value);
  if (!isValidEmail(normalized)) return null;
  const at = normalized.lastIndexOf('@');
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (COMMON_DOMAINS.includes(domain)) return null;
  for (const candidate of COMMON_DOMAINS) {
    // 1 edit for short domains, 2 for longer ones — at distance 2 on a short
    // domain the "correction" stops being a typo fix and starts being a guess.
    const max = candidate.length > 9 ? 2 : 1;
    if (distance(domain, candidate, max) <= max) return `${local}@${candidate}`;
  }
  return null;
}
