/**
 * Single source of truth for "is this a plausible email address" — imported
 * by both the API (ClientsService) and the web form (client-form-schema.ts)
 * so format validation can't drift into accepting/rejecting different
 * strings on either side (e.g. class-validator's IsEmail vs zod's .email()
 * use different regexes and disagree on edge cases).
 *
 * Plain JS (not .ts) on purpose: this file is loaded three different ways —
 * raw by Vite (web), through ts-jest (api unit/e2e tests), and via Node's
 * own module resolution at api runtime (`nest start`/`node dist/main.js`,
 * where `@cockpit/shared` has no compiled output to point at). Node's native
 * loader needs a real, already-valid-JS file to find at the exact path a
 * relative import specifies — a `.ts` source file doesn't satisfy that
 * without a build step this package deliberately doesn't have.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value) {
  return EMAIL_PATTERN.test(value);
}

/** Trims + lowercases so "Foo@Bar.com" and "foo@bar.com" dedupe as the same address. */
export function normalizeEmail(value) {
  return value.trim().toLowerCase();
}
