import { describe, expect, it } from 'vitest'
import { isValidEmail, normalizeEmail, suggestEmailDomain } from './email.js'

describe('isValidEmail', () => {
  it('accepts real addresses', () => {
    expect(isValidEmail('romain.heloise@placeloop.com')).toBe(true)
    expect(isValidEmail('a+tag@example.co.uk')).toBe(true)
    expect(isValidEmail("o'brien@example.com")).toBe(true)
  })

  it('requires a dotted domain with a real TLD', () => {
    // Both of these pass the raw HTML5 <input type="email"> pattern.
    expect(isValidEmail('a@b')).toBe(false)
    expect(isValidEmail('a@b.c')).toBe(false)
    expect(isValidEmail('a@b.com.')).toBe(false)
  })

  it('rejects misplaced dots in the local part', () => {
    expect(isValidEmail('.a@b.com')).toBe(false)
    expect(isValidEmail('a.@b.com')).toBe(false)
    expect(isValidEmail('a..b@c.com')).toBe(false)
  })

  it('rejects the obvious malformations', () => {
    expect(isValidEmail('a b@c.com')).toBe(false)
    expect(isValidEmail('ac.com')).toBe(false)
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail(null)).toBe(false)
  })
})

describe('normalizeEmail', () => {
  it('trims and lowercases so addresses dedupe', () => {
    expect(normalizeEmail('  Foo@Bar.COM ')).toBe('foo@bar.com')
  })
})

describe('suggestEmailDomain', () => {
  it('catches transposed characters, the commonest typo', () => {
    expect(suggestEmailDomain('romain@gmial.com')).toBe('romain@gmail.com')
    expect(suggestEmailDomain('a@hotmial.fr')).toBe('a@hotmail.fr')
    expect(suggestEmailDomain('a@ornage.fr')).toBe('a@orange.fr')
  })

  it('catches missing and wrong characters', () => {
    expect(suggestEmailDomain('a@gmai.com')).toBe('a@gmail.com')
    expect(suggestEmailDomain('a@outlok.com')).toBe('a@outlook.com')
  })

  it('normalizes before suggesting', () => {
    expect(suggestEmailDomain(' A@GMIAL.COM ')).toBe('a@gmail.com')
  })

  it('stays quiet on correct and unknown domains', () => {
    expect(suggestEmailDomain('a@gmail.com')).toBeNull()
    expect(suggestEmailDomain('a@placeloop.com')).toBeNull()
  })

  it('stays quiet on an address that is not valid yet', () => {
    // Mid-typing, the suggestion would flicker against a moving target.
    expect(suggestEmailDomain('a@b')).toBeNull()
    expect(suggestEmailDomain('')).toBeNull()
    expect(suggestEmailDomain(null)).toBeNull()
  })
})
