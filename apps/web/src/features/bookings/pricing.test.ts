import { describe, expect, it } from 'vitest'
import { asdTotal, marginPercent } from '@cockpit/shared'

describe('marginPercent', () => {
  // France: no VAT adjustment — (retail − partner) / retail.
  it('compares raw amounts for a French booking', () => {
    expect(marginPercent({ priceEur: 200, partnerRateEur: 150, countryCode: 'FR' })).toBeCloseTo(25)
  })

  // Abroad: French VAT is stripped from the retail price first, because a
  // foreign partner's rate carries none. 200/1.1 = 181.82, minus 150 → 17.5%.
  it('strips French VAT from the retail price abroad', () => {
    expect(marginPercent({ priceEur: 200, partnerRateEur: 150, countryCode: 'CH' })).toBeCloseTo(17.5, 1)
  })

  it('is negative when the partner costs more than the booking earns', () => {
    expect(marginPercent({ priceEur: 100, partnerRateEur: 120, countryCode: 'FR' })).toBeCloseTo(-20)
  })

  it('returns null rather than a misleading 0% when it is not computable', () => {
    expect(marginPercent({ priceEur: undefined, partnerRateEur: 150, countryCode: 'FR' })).toBeNull()
    expect(marginPercent({ priceEur: 200, partnerRateEur: undefined, countryCode: 'FR' })).toBeNull()
    expect(marginPercent({ priceEur: 0, partnerRateEur: 150, countryCode: 'FR' })).toBeNull()
  })
})

describe('asdTotal', () => {
  it('multiplies the hourly rate by the hours for an ASD booking', () => {
    expect(asdTotal({ rate: 80, hours: 6, service: 'ASD' })).toBe(480)
  })

  it('is null for any other service — the field is a flat price there', () => {
    expect(asdTotal({ rate: 80, hours: 6, service: 'TSF' })).toBeNull()
    expect(asdTotal({ rate: 80, hours: 6, service: 'SPEC' })).toBeNull()
  })

  it('is null while the rate or the hours are still missing', () => {
    expect(asdTotal({ rate: undefined, hours: 6, service: 'ASD' })).toBeNull()
    expect(asdTotal({ rate: 80, hours: undefined, service: 'ASD' })).toBeNull()
  })
})
