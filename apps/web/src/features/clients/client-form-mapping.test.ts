import { describe, expect, it } from 'vitest'
import { ClientEntityClientType } from '@cockpit/shared/api'
import { baseClient } from './test-fixtures'
import { clientToFormValues } from './client-form-mapping'

describe('clientToFormValues', () => {
  it('reduces eventStartDate/eventEndDate to a plain date, not the full ISO instant Prisma serializes them as', () => {
    const client = baseClient({
      clientType: ClientEntityClientType.EVENT,
      eventStartDate: '2027-06-01T00:00:00.000Z',
      eventEndDate: '2027-06-03T00:00:00.000Z',
    })
    const values = clientToFormValues(client)
    // <input type="date"> only accepts YYYY-MM-DD — a full ISO instant is
    // silently rejected by the browser and the field renders empty.
    expect(values.eventStartDate).toBe('2027-06-01')
    expect(values.eventEndDate).toBe('2027-06-03')
  })

  it('falls back to an empty string when the dates are null', () => {
    const client = baseClient({ clientType: ClientEntityClientType.EVENT, eventStartDate: null, eventEndDate: null })
    const values = clientToFormValues(client)
    expect(values.eventStartDate).toBe('')
    expect(values.eventEndDate).toBe('')
  })
})
