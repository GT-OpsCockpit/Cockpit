import { describe, expect, it } from 'vitest'
import { baseClient, baseDriver, baseTrip } from '../bookings/test-fixtures'
import { applyPartnerFilters, defaultPartnerFilters } from './partner-filters'

describe('applyPartnerFilters', () => {
  const filters = { ...defaultPartnerFilters(), dateStart: '', dateEnd: '' }

  it('only includes trips with a partner assigned', () => {
    const withPartner = baseTrip({ ref: 'R1', partner: baseDriver({ ref: 'D1', company: 'Acme Cars' }) })
    const withoutPartner = baseTrip({ ref: 'R2', partner: null })
    expect(applyPartnerFilters([withPartner, withoutPartner], filters).map((t) => t.ref)).toEqual(['R1'])
  })

  it('scopes by partnerRef, eventRef (on the trip client) and ref/PO', () => {
    const partnerA = baseDriver({ ref: 'D1', company: 'Acme Cars' })
    const partnerB = baseDriver({ ref: 'D2', company: 'Other Cars' })
    const t1 = baseTrip({ ref: 'R1', partner: partnerA, client: baseClient({ ref: 'CE1', refPoOther: 'PO-1' }) })
    const t2 = baseTrip({ ref: 'R2', partner: partnerB, client: baseClient({ ref: 'CE2' }) })

    expect(applyPartnerFilters([t1, t2], { ...filters, partnerRef: 'D1' }).map((t) => t.ref)).toEqual(['R1'])
    expect(applyPartnerFilters([t1, t2], { ...filters, eventRef: 'CE2' }).map((t) => t.ref)).toEqual(['R2'])
    expect(applyPartnerFilters([t1, t2], { ...filters, refPo: 'po-1' }).map((t) => t.ref)).toEqual(['R1'])
  })

  it('scopes by date range (Europe/Paris)', () => {
    const inRange = baseTrip({ ref: 'R1', partner: baseDriver(), pickupAt: '2026-06-15T10:00:00.000Z' })
    const outOfRange = baseTrip({ ref: 'R2', partner: baseDriver(), pickupAt: '2026-07-15T10:00:00.000Z' })
    const result = applyPartnerFilters([inRange, outOfRange], { ...filters, dateStart: '2026-06-01', dateEnd: '2026-06-30' })
    expect(result.map((t) => t.ref)).toEqual(['R1'])
  })
})
