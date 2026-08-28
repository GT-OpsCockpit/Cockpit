import {
  areaCityLimit,
  areaSuggestions,
  isLocalAreaAllowed,
} from './area-suggestions';
import { MAJOR_CITIES } from '../constants/major-cities';

describe('areaCityLimit', () => {
  it('caps a US state at 3, France at 25, the rest of Europe at 12 and everywhere else at 5', () => {
    expect(areaCityLimit('US-NY')).toBe(3);
    expect(areaCityLimit('FR')).toBe(25);
    expect(areaCityLimit('IT')).toBe(12);
    expect(areaCityLimit('GB')).toBe(12);
    expect(areaCityLimit('JP')).toBe(5);
    expect(areaCityLimit('MA')).toBe(5);
  });

  // The US is the one country whose codes are regional, and it must not fall
  // through to the "rest of the world" branch on its base code.
  it('reads the US cap off the full regional code, not the base one', () => {
    expect(areaCityLimit('US')).toBe(5);
    expect(areaCityLimit('US-CA')).toBe(3);
  });
});

describe('isLocalAreaAllowed', () => {
  it('only allows "Local" in France', () => {
    expect(isLocalAreaAllowed('FR')).toBe(true);
    expect(isLocalAreaAllowed('MC')).toBe(false);
    expect(isLocalAreaAllowed('IT')).toBe(false);
    expect(isLocalAreaAllowed('US-NY')).toBe(false);
    expect(isLocalAreaAllowed('')).toBe(false);
  });
});

describe('areaSuggestions', () => {
  it('returns nothing until a country is chosen', () => {
    expect(areaSuggestions('')).toEqual([]);
  });

  it("suggests the chosen country's own cities, and only those", () => {
    const italian = new Set(
      MAJOR_CITIES.filter((c) => c.country === 'IT').map((c) => c.name),
    );
    const suggestions = areaSuggestions('IT');
    expect(suggestions.length).toBeGreaterThan(0);
    for (const name of suggestions) expect(italian.has(name)).toBe(true);
  });

  it('ties US cities to the exact state code, never to a sibling state', () => {
    const newYork = areaSuggestions('US-NY');
    const california = areaSuggestions('US-CA');
    expect(newYork.length).toBeGreaterThan(0);
    expect(california.length).toBeGreaterThan(0);
    for (const name of newYork) expect(california).not.toContain(name);
  });

  it('never returns more than the zone cap', () => {
    expect(areaSuggestions('US-NY').length).toBeLessThanOrEqual(3);
    expect(areaSuggestions('FR').length).toBeLessThanOrEqual(25);
    expect(areaSuggestions('IT').length).toBeLessThanOrEqual(12);
    expect(areaSuggestions('JP').length).toBeLessThanOrEqual(5);
  });

  // "Local" is not a city: it comes from isLocalAreaAllowed, and mixing it
  // into the catalogue here would leak it into every country's list.
  it('never includes "Local" itself', () => {
    expect(areaSuggestions('FR')).not.toContain('Local');
  });
});
