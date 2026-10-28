import { describe, expect, it } from 'vitest'
import { billedAmount, retailNet } from './pricing.js'

describe('billedAmount', () => {
  it('multiplies the hourly rate by the hours for an ASD booking', () => {
    expect(billedAmount({ rate: 250, hours: 4, service: 'ASD' })).toBe(1000)
  })

  it('keeps the flat price for any other service, whatever the hours', () => {
    expect(billedAmount({ rate: 120, hours: 4, service: 'TRANSFER' })).toBe(120)
  })

  it('falls back to the rate when an ASD booking has no hours, and is null without a rate', () => {
    expect(billedAmount({ rate: 250, hours: null, service: 'ASD' })).toBe(250)
    expect(billedAmount({ rate: null, hours: 4, service: 'ASD' })).toBeNull()
  })
})

describe('retailNet', () => {
  it('strips the 10% VAT a retail amount includes, to the cent', () => {
    expect(retailNet(110)).toBe(100)
    expect(retailNet(1000)).toBe(909.09)
  })

  it('takes the multiplier of the invoice when it is not the default', () => {
    expect(retailNet(120, 1.2)).toBe(100)
  })
})
