import { describe, expect, it } from 'vitest'
import { toUpdateDriverDto } from './driver-form-mapping'
import { driverFormDefaults, type DriverFormValues } from './driver-form-schema'

const values = (overrides: Partial<DriverFormValues> = {}): DriverFormValues => ({
  ...driverFormDefaults(),
  countryCode: 'FR',
  area: 'Nice',
  firstName: 'John',
  lastName: 'Doe',
  phone: '+33612345678',
  company: 'Riviera Cars',
  email: 'john@riviera.test',
  ...overrides,
})

describe('toUpdateDriverDto', () => {
  // drivers.service.ts's update() only writes a field when it's present at all
  // (`dto.field !== undefined`) — this form always submits the whole record, so a
  // field the operator deliberately blanked has to reach the API as '', not as
  // undefined, or update() reads "not sent" and leaves the old value in place.
  it('sends a cleared phone as an empty string, not undefined', () => {
    expect(toUpdateDriverDto(values({ phone: '' })).phone).toBe('')
  })

  it('sends a cleared company as an empty string, not undefined', () => {
    expect(toUpdateDriverDto(values({ company: '' })).company).toBe('')
  })

  it('sends a cleared email as an empty string, not undefined', () => {
    expect(toUpdateDriverDto(values({ email: '' })).email).toBe('')
  })

  it('sends cleared first/last names as empty strings, not undefined', () => {
    const dto = toUpdateDriverDto(values({ firstName: '', lastName: '' }))
    expect(dto.firstName).toBe('')
    expect(dto.lastName).toBe('')
  })

  it('still sends a filled-in phone through unchanged', () => {
    expect(toUpdateDriverDto(values()).phone).toBe('+33612345678')
  })
})
