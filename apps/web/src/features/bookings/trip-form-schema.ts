import { z } from 'zod'
import { TripEntityBilling, TripEntityService } from '@cockpit/shared/api'
import { optionalPhone } from '@/lib/contact-fields'

// Bounds whose message is shown verbatim by <FormMessage>, so they say what
// the field is rather than what the constraint is — Zod's own default
// ("Too small: expected number to be >=1") reached the screen otherwise.
const PAX_RANGE = 'Pax nb must be between 1 and 50.'
const NEGATIVE_PRICE = 'A price cannot be negative.'
const NEGATIVE_BUFFER = 'Buffer time cannot be negative.'

export const tripFormSchema = z
  .object({
    countryCode: z.string().min(1, 'Country is required.'),
    area: z.string().min(1, 'Area is required.'),
    pickupDate: z.string().min(1, 'Date is required.'),
    pickupTime: z.string().min(1, 'Time is required.'),
    service: z.enum([TripEntityService.TSF, TripEntityService.ASD, TripEntityService.SPEC]),
    hours: z.number().int().optional(),
    vehicleType: z.string().min(1, 'Vehicle is required.'),
    paxCount: z.number().int(PAX_RANGE).min(1, PAX_RANGE).max(50, PAX_RANGE),
    clientRef: z.string().min(1, 'Customer is required.'),
    billing: z.enum([TripEntityBilling.ACCOUNT, TripEntityBilling.CASH, TripEntityBilling.CARD]),
    passengerName: z.string().min(1, 'Passenger name is required.'),
    pickupLocation: z.string().min(1, 'Pickup location is required.'),
    dropoffLocation: z.string().optional(),
    instructions: z.string().optional(),
    pocName: z.string().optional(),
    pocPhone: optionalPhone(),
    driverRef: z.string().optional(),
    fleetRegNbr: z.string().optional(),
    subContractor: z.boolean(),
    partnerRef: z.string().optional(),
    // A Partner *company* to farm the job out to with no driver of theirs
    // picked yet — mutually exclusive with partnerRef, see the superRefine
    // below. The "Partner" field in the form flips between the two based on
    // its own "No specific driver" toggle (subContractorNoDriver).
    directPartnerRef: z.string().optional(),
    subContractorNoDriver: z.boolean().optional(),
    priceEur: z.number().min(0, NEGATIVE_PRICE).optional(),
    partnerRateEur: z.number().min(0, NEGATIVE_PRICE).optional(),
    tracking: z.boolean(),
    flightNumber: z.string().optional(),
    bufferTime: z.number().int(NEGATIVE_BUFFER).min(0, NEGATIVE_BUFFER).optional(),
    fboAddress: z.string().optional(),
    tailNbr: z.string().optional(),
    nameboard: z.string().optional(),
    pickupIata: z.string().optional(),
    dropoffIata: z.string().optional(),
    pickupTimezone: z.string().optional(),
    /**
     * Whether the located pickup/drop-off is an airport. Form-only, never
     * sent: the flight block used to appear only once an IATA code was known,
     * and geocoding does not always return one — an airport pickup with no
     * IATA on file then had nowhere to enter its flight number at all. The
     * legacy opened its Flight info popup on "is an airport" (common.js:1406).
     */
    pickupIsAirport: z.boolean().optional(),
    dropoffIsAirport: z.boolean().optional(),
    notifyDriver: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.service !== TripEntityService.ASD && !data.dropoffLocation?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['dropoffLocation'],
        message: 'Drop-off location is required (except for an ASD service).',
      })
    }
    if (data.service === TripEntityService.ASD) {
      if (data.hours === undefined || data.hours < 2 || data.hours > 48) {
        ctx.addIssue({
          code: 'custom',
          path: ['hours'],
          message: 'Hours is required for an ASD service, between 2 and 48.',
        })
      }
    }
    // An airport pickup is a meet-and-greet: the booking cannot be created
    // without its flight details. Commercial → the flight number. Private →
    // the tail number AND the handling agent's address (FBO). The legacy forced
    // its Flight info popup open here; the block is inline now, so nothing asked
    // and the booking went out blind. Mirrored server-side in
    // common/business/booking-fields.ts (which only knows the IATA code).
    if (data.pickupIsAirport && !data.flightNumber?.trim()) {
      if (!data.tailNbr?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['flightNumber'],
          message: 'Airport pickup: enter the flight number, or the tail number for a private flight.',
        })
      }
      if (!data.fboAddress?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['fboAddress'],
          message: 'Private flight: the FBO address is required.',
        })
      }
    }
    if (data.service === TripEntityService.SPEC && !data.instructions?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['instructions'],
        message: 'Instructions are required for a SPEC service.',
      })
    }
    // Farming a job out no longer requires agreeing a price for it up front —
    // unlike the legacy's sub-contract popup ("Enter the Partner rate net to
    // validate the subcontracting", common.js:2812), which this form replaces.
    // Both Retail price and Partner rate net can be left blank at creation and
    // filled in once they're known, same as for a booking that isn't farmed
    // out at all.
    // …naming who it is farmed out to is still required, though. The legacy kept the submit button
    // greyed out until the Partner company was entered (refreshFormGuards,
    // common.js:1046-1054). Saved without one, the booking is farmed out to
    // nobody: the server pins it at "Sent" and never re-arms Send
    // (decideAssignment's `locked`), so it quietly goes nowhere.
    if (data.subContractor) {
      const hasDriver = !!data.partnerRef?.trim()
      const hasCompanyOnly = !!data.directPartnerRef?.trim()
      if (!hasDriver && !hasCompanyOnly) {
        ctx.addIssue({
          code: 'custom',
          path: data.subContractorNoDriver ? ['directPartnerRef'] : ['partnerRef'],
          message: 'Partner company is required to sub-contract a booking.',
        })
      }
    }
  })

export type TripFormValues = z.infer<typeof tripFormSchema>

export function tripFormDefaults(): TripFormValues {
  return {
    countryCode: '',
    // No default Area: "Local" is only valid in France and no country is
    // chosen yet, so seeding it would be seeding an invalid value (see
    // AreaField / common/business/area-suggestions.ts).
    area: '',
    pickupDate: '',
    pickupTime: '',
    service: TripEntityService.TSF,
    hours: undefined,
    vehicleType: '',
    paxCount: 1,
    clientRef: '',
    billing: TripEntityBilling.ACCOUNT,
    passengerName: '',
    pickupLocation: '',
    dropoffLocation: '',
    instructions: '',
    pocName: '',
    pocPhone: '',
    driverRef: '',
    fleetRegNbr: '',
    subContractor: false,
    partnerRef: '',
    directPartnerRef: '',
    subContractorNoDriver: false,
    priceEur: undefined,
    partnerRateEur: undefined,
    tracking: true,
    flightNumber: '',
    bufferTime: undefined,
    fboAddress: '',
    tailNbr: '',
    nameboard: '',
    pickupIata: '',
    dropoffIata: '',
    pickupTimezone: '',
    pickupIsAirport: false,
    dropoffIsAirport: false,
    notifyDriver: false,
  }
}
