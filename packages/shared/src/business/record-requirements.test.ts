import { describe, expect, it } from 'vitest'
import { missingFields, type RecordKind, type RecordValues } from './record-requirements.js'

/** The messages a caller is missing, flattened for a table assertion. */
const messagesFor = (kind: RecordKind, values: RecordValues) => missingFields(kind, values).map((g) => g.message)
const fieldsFor = (kind: RecordKind, values: RecordValues) => missingFields(kind, values).flatMap((g) => g.fields)

describe('missingFields — accounts', () => {
  const complete: Record<string, RecordValues> = {
    INDIVIDUAL: { clientType: 'INDIVIDUAL', contactFirstName: 'Jane', contactLastName: 'Doe' },
    COMPANY: { clientType: 'COMPANY', company: 'Atlas Capital' },
    EVENT: {
      clientType: 'EVENT',
      company: 'Grand Prix',
      eventCountry: 'MC',
      eventArea: 'Monaco',
      eventStartDate: '2026-05-01',
      eventEndDate: '2026-05-03',
    },
  }

  it.each(Object.keys(complete))('asks for nothing when a %s account is complete', (type) => {
    expect(missingFields('client', complete[type])).toEqual([])
  })

  const cases: [string, RecordValues, string[]][] = [
    ['a Company with no name', { clientType: 'COMPANY' }, ['Company name is required for a Company-type account.']],
    [
      'an Events account with no name',
      { ...complete.EVENT, company: '' },
      ['Event name is required for an Events-type account.'],
    ],
    [
      'an Events account with no country',
      { ...complete.EVENT, eventCountry: '' },
      ['Country is required for an Events-type account.'],
    ],
    [
      'an Events account with no area',
      { ...complete.EVENT, eventArea: '' },
      ['Area is required for an Events-type account.'],
    ],
    [
      'an Events account with no start date',
      { ...complete.EVENT, eventStartDate: '' },
      ['Start date is required for an Events-type account.'],
    ],
    [
      'an Events account with no end date',
      { ...complete.EVENT, eventEndDate: '' },
      ['End date is required for an Events-type account.'],
    ],
    [
      'an Individual with only a first name',
      { clientType: 'INDIVIDUAL', contactFirstName: 'Jane' },
      ['First and last name are required for an Individual-type account.'],
    ],
  ]

  it.each(cases)('names what is missing from %s', (_label, values, expected) => {
    expect(messagesFor('client', values)).toEqual(expected)
  })

  // One rule, two fields: the form has to mark both, which is why a gap
  // carries a list rather than a single field name.
  it("marks both name fields when an Individual's name is incomplete", () => {
    expect(missingFields('client', { clientType: 'INDIVIDUAL' })).toEqual([
      {
        fields: ['contactFirstName', 'contactLastName'],
        message: 'First and last name are required for an Individual-type account.',
      },
    ])
  })

  // ClientsService.update() merges the DTO over the stored row, where the
  // event dates come back as Date objects rather than strings.
  it('accepts a stored Date as a filled-in event date', () => {
    expect(
      missingFields('client', {
        ...complete.EVENT,
        eventStartDate: new Date('2026-05-01'),
        eventEndDate: new Date('2026-05-03'),
      }),
    ).toEqual([])
  })

  // The legacy refused to enable Confirm on an inverted range and set
  // dateEnd.min from dateStart (clients.html:436-448, events.html:401-413).
  // Nothing downstream survives an event that ends before it starts: the
  // "not ended" filter, the availability window, the reactivation candidates
  // and the Events bulk — which silently creates zero bookings.
  it('refuses an event that ends before it starts', () => {
    expect(
      missingFields('client', { ...complete.EVENT, eventStartDate: '2026-05-03', eventEndDate: '2026-05-01' }),
    ).toEqual([
      {
        fields: ['eventStartDate', 'eventEndDate'],
        message: 'End date must be on or after the start date.',
      },
    ])
  })

  it('accepts a single-day event', () => {
    expect(
      missingFields('client', { ...complete.EVENT, eventStartDate: '2026-05-01', eventEndDate: '2026-05-01' }),
    ).toEqual([])
  })

  it('compares stored Dates as well as typed strings', () => {
    expect(
      messagesFor('client', {
        ...complete.EVENT,
        eventStartDate: new Date('2026-05-03'),
        eventEndDate: new Date('2026-05-01'),
      }),
    ).toEqual(['End date must be on or after the start date.'])
  })

  // Only ever one complaint per field pair: an absent end date is already
  // reported as missing, and "must be on or after" would be noise on top.
  it('says nothing about ordering while a date is still missing', () => {
    expect(messagesFor('client', { ...complete.EVENT, eventEndDate: '' })).toEqual([
      'End date is required for an Events-type account.',
    ])
  })

  it('does not accept whitespace as a filled-in field', () => {
    expect(messagesFor('client', { clientType: 'COMPANY', company: '   ' })).toEqual([
      'Company name is required for a Company-type account.',
    ])
  })
})

describe('missingFields — drivers', () => {
  const ownChauffeur = { countryCode: 'FR', firstName: 'Julien', lastName: 'Petit', phone: '+33698765432' }
  const partnerChauffeur = { ...ownChauffeur, company: 'Riviera Cars', email: 'j@riviera.test' }
  const partnerCompany = { countryCode: 'FR', company: 'Riviera Cars', email: 'contact@riviera.test' }
  const eventsDriver = {
    ...partnerChauffeur,
    eventsOnly: true,
    eventCountry: 'MC',
    eventArea: 'Monaco',
    eventRef: 'CE1',
  }

  it.each([
    ['an own chauffeur', ownChauffeur],
    ['a partner chauffeur', partnerChauffeur],
    ['a partner company', partnerCompany],
    ['an Events driver', eventsDriver],
  ])('asks for nothing when %s is complete', (_label, values) => {
    expect(missingFields('driver', values)).toEqual([])
  })

  const cases: [string, RecordValues, string[]][] = [
    ['an own chauffeur with no first name', { ...ownChauffeur, firstName: '' }, ['First name is required.']],
    ['an own chauffeur with no last name', { ...ownChauffeur, lastName: '' }, ['Last name is required.']],
    ['an own chauffeur with no phone', { ...ownChauffeur, phone: '' }, ['Phone is required.']],
    [
      'a partner chauffeur with no email',
      { ...partnerChauffeur, email: '' },
      ['Email is required for a partner chauffeur.'],
    ],
    [
      'a partner chauffeur with no phone',
      { ...partnerChauffeur, phone: '' },
      ['Phone is required for a partner chauffeur.'],
    ],
    ['a partner company with no email', { ...partnerCompany, email: '' }, ['Email is required for a partner company.']],
    ['an Events driver with no company', { ...eventsDriver, company: '' }, ['Company is required for an Events driver.']],
    ['an Events driver with no email', { ...eventsDriver, email: '' }, ['Email is required for an Events driver.']],
    ['an Events driver with no phone', { ...eventsDriver, phone: '' }, ['Phone is required for an Events driver.']],
    ['an Events driver with no country', { ...eventsDriver, eventCountry: '' }, ['Country is required to link an Event.']],
    ['an Events driver with no area', { ...eventsDriver, eventArea: '' }, ['Area is required to link an Event.']],
    ['an Events driver with no Event linked', { ...eventsDriver, eventRef: '' }, ['An Event must be selected.']],
    // Where the driver is based — asked of every kind alike, and asked first,
    // because it is not the discriminant that decides it. The legacy marked
    // the field `required` on its one form (drivers.html:205), and v2's own
    // ref prefix, Area suggestions and Event link all key on it.
    ['an own chauffeur with no country', { ...ownChauffeur, countryCode: '' }, ['Country is required.']],
    ['a partner chauffeur with no country', { ...partnerChauffeur, countryCode: '' }, ['Country is required.']],
    ['a partner company with no country', { ...partnerCompany, countryCode: '' }, ['Country is required.']],
    ['an Events driver with no country', { ...eventsDriver, countryCode: '' }, ['Country is required.']],
  ]

  it.each(cases)('names what is missing from %s', (_label, values, expected) => {
    expect(messagesFor('driver', values)).toEqual(expected)
  })

  // A Company turns an own chauffeur into a partner, and the phone stops
  // being required in the branch where no person is named at all.
  it('changes which fields apply as soon as a Company is typed', () => {
    expect(messagesFor('driver', { countryCode: 'FR', company: 'Riviera Cars' })).toEqual([
      'Email is required for a partner company.',
    ])
    expect(messagesFor('driver', {})).toEqual([
      'Country is required.',
      'First name is required.',
      'Last name is required.',
      'Phone is required.',
    ])
  })
})

describe('missingFields — fleet vehicles', () => {
  const local = { isLocal: true }
  const external = { isLocal: false, countryCode: 'MC', area: 'Monaco', partnerCompany: 'Riviera Cars' }
  const eventsVehicle = { ...local, eventsOnly: true, eventCountry: 'MC', eventArea: 'Monaco', eventRef: 'CE1' }

  it.each([
    ['a Local vehicle', local],
    ['an external vehicle', external],
    ['an Events vehicle', eventsVehicle],
  ])('asks for nothing when %s is complete', (_label, values) => {
    expect(missingFields('fleetVehicle', values)).toEqual([])
  })

  // Same default as the API: a vehicle with no `isLocal` at all is Local, so
  // none of the external requirements apply to it.
  it('treats a vehicle that never said otherwise as Local', () => {
    expect(missingFields('fleetVehicle', {})).toEqual([])
  })

  const cases: [string, RecordValues, string[]][] = [
    [
      'an external vehicle with no country',
      { ...external, countryCode: '' },
      ['Country is required for an external (non-local) vehicle.'],
    ],
    [
      'an external vehicle with no area',
      { ...external, area: '' },
      ['Area is required for an external (non-local) vehicle.'],
    ],
    [
      'an external vehicle with no partner',
      { ...external, partnerCompany: '' },
      ['Partner is required for an external (non-local) vehicle.'],
    ],
    ['an Events vehicle with no country', { ...eventsVehicle, eventCountry: '' }, ['Country is required to link an Event.']],
    ['an Events vehicle with no area', { ...eventsVehicle, eventArea: '' }, ['Area is required to link an Event.']],
    ['an Events vehicle with no Event linked', { ...eventsVehicle, eventRef: '' }, ['An Event must be selected.']],
  ]

  it.each(cases)('names what is missing from %s', (_label, values, expected) => {
    expect(messagesFor('fleetVehicle', values)).toEqual(expected)
  })

  it('gathers both blocks when an external vehicle is also an Events one', () => {
    expect(fieldsFor('fleetVehicle', { isLocal: false, eventsOnly: true })).toEqual([
      'countryCode',
      'area',
      'partnerCompany',
      'eventCountry',
      'eventArea',
      'eventRef',
    ])
  })
})

describe('missingFields', () => {
  it('refuses a kind it has no rules for, rather than silently passing it', () => {
    // @ts-expect-error — the point of the test is the runtime guard.
    expect(() => missingFields('invoice', {})).toThrow(/Unknown record kind/)
  })
})
