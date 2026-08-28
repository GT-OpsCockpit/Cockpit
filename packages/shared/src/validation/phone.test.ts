import { describe, expect, it } from 'vitest'
import { formatPhoneDisplay, isValidPhone, phoneCountry, toE164 } from './phone.js'
import { toIso2 } from '../business/country-code.js'

describe('isValidPhone', () => {
  it('accepts a complete E.164 number, with or without spacing', () => {
    expect(isValidPhone('+33612345678')).toBe(true)
    expect(isValidPhone('+33 6 12 34 56 78')).toBe(true)
    expect(isValidPhone('+442071234000')).toBe(true)
  })

  it('rejects anything without a leading +', () => {
    // The two formats the pre-E.164 storage let coexist: a French national
    // number and a country code with the + stripped. Neither is decidable
    // without a country hint, which is exactly why the API refuses both.
    expect(isValidPhone('0612345678')).toBe(false)
    expect(isValidPhone('33612345678')).toBe(false)
  })

  it('validates digit patterns, not just length', () => {
    // "+33400456789" has a plausible French length but 04-00 is not an
    // allocated prefix. libphonenumber's default /min metadata accepts it;
    // only /max rejects it — so this test also guards the metadata import.
    expect(isValidPhone('+33400456789')).toBe(false)
  })

  it('treats empty and non-strings as invalid', () => {
    expect(isValidPhone('')).toBe(false)
    expect(isValidPhone('   ')).toBe(false)
    expect(isValidPhone(null)).toBe(false)
    expect(isValidPhone(undefined)).toBe(false)
    expect(isValidPhone('not a phone')).toBe(false)
  })
})

describe('toE164', () => {
  it('promotes a national number using the country hint', () => {
    expect(toE164('06 12 34 56 78', 'FR')).toBe('+33612345678')
    expect(toE164('(213) 373-4253', 'US')).toBe('+12133734253')
  })

  it('cannot promote a national number without a hint', () => {
    expect(toE164('0612345678')).toBeNull()
  })

  it('passes an already-international number through, canonicalised', () => {
    expect(toE164('+33 6 12 34 56 78')).toBe('+33612345678')
  })

  it('knows Kosovo, which is not ISO-assigned', () => {
    expect(toE164('+383 44 123 456')).toBe('+38344123456')
  })

  it('returns null rather than throwing on junk', () => {
    expect(toE164('abc', 'FR')).toBeNull()
    expect(toE164('', 'FR')).toBeNull()
    expect(toE164(null)).toBeNull()
  })
})

describe('formatPhoneDisplay', () => {
  it('renders international spacing', () => {
    expect(formatPhoneDisplay('+33612345678')).toBe('+33 6 12 34 56 78')
  })

  it('returns unparsable values as-is, so a row the backfill skipped still shows', () => {
    expect(formatPhoneDisplay('0612345678')).toBe('0612345678')
  })

  it('renders empty for absent values', () => {
    expect(formatPhoneDisplay(null)).toBe('')
    expect(formatPhoneDisplay('')).toBe('')
  })
})

describe('phoneCountry', () => {
  it('reads the country back off the number', () => {
    expect(phoneCountry('+33612345678')).toBe('FR')
    expect(phoneCountry('+12133734253')).toBe('US')
  })

  it('is null when there is nothing to read', () => {
    expect(phoneCountry('0612345678')).toBeNull()
    expect(phoneCountry(null)).toBeNull()
  })
})

describe('toIso2', () => {
  it('strips the subdivision suffix off the catalogue pseudo-codes', () => {
    expect(toIso2('US-NY')).toBe('US')
    expect(toIso2('AU-NSW')).toBe('AU')
    expect(toIso2('RU-MOW')).toBe('RU')
  })

  it('leaves a real alpha-2 alone', () => {
    expect(toIso2('FR')).toBe('FR')
    expect(toIso2('XK')).toBe('XK')
  })

  it('is null when there is no code', () => {
    expect(toIso2('')).toBeNull()
    expect(toIso2(null)).toBeNull()
    expect(toIso2(undefined)).toBeNull()
  })
})
