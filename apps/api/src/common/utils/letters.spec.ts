import { letters } from './letters';

describe('letters', () => {
  it('strips accents, keeps only letters, uppercases and truncates', () => {
    expect(letters('Uber', 3)).toBe('UBE');
    expect(letters('Île-de-France', 2)).toBe('IL');
    expect(letters('San José', 3)).toBe('SAN');
  });

  it('returns an empty string for null/undefined/blank input', () => {
    expect(letters(null, 3)).toBe('');
    expect(letters(undefined, 3)).toBe('');
    expect(letters('', 3)).toBe('');
  });
});
