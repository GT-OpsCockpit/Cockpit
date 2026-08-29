import { describe, expect, it } from 'vitest'
import { baseClient, baseDriver, baseTrip } from '../bookings/test-fixtures'
import { applyPartnerFilters, defaultPartnerFilters } from './partner-filters'

// "Has a partner" and the date range are the API's now (hasPartner + from/to,
// see partner-log-tab.tsx and trips.e2e-spec.ts) — what is left here is the
// narrowing the API has no parameter for.
describe('applyPartnerFilters', () => {
  const filters = { ...defaultPartnerFilters(), dateStart: '', dateEnd: '' }

  it('scopes by partnerRef, eventRef (on the trip client) and ref/PO', () => {
    const partnerA = baseDriver({ ref: 'D1', company: 'Acme Cars' })
    const partnerB = baseDriver({ ref: 'D2', company: 'Other Cars' })
    const t1 = baseTrip({ ref: 'R1', partner: partnerA, client: baseClient({ ref: 'CE1', refPoOther: 'PO-1' }) })
    const t2 = baseTrip({ ref: 'R2', partner: partnerB, client: baseClient({ ref: 'CE2' }) })

    expect(applyPartnerFilters([t1, t2], { ...filters, partnerRef: 'D1' }).map((t) => t.ref)).toEqual(['R1'])
    expect(applyPartnerFilters([t1, t2], { ...filters, eventRef: 'CE2' }).map((t) => t.ref)).toEqual(['R2'])
    expect(applyPartnerFilters([t1, t2], { ...filters, refPo: 'po-1' }).map((t) => t.ref)).toEqual(['R1'])
  })
})
