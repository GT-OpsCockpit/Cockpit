import { z } from 'zod'
import { TripEntityBilling, TripEntityService } from '@cockpit/shared/api'

export const tripFormSchema = z
  .object({
    countryCode: z.string().min(1, 'Country is required.'),
    area: z.string().min(1).default('Local'),
    pickupDate: z.string().min(1, 'Date is required.'),
    pickupTime: z.string().min(1, 'Time is required.'),
    service: z.enum([TripEntityService.TSF, TripEntityService.ASD, TripEntityService.SPEC]),
    hours: z.coerce.number().int().optional(),
    vehicleType: z.string().min(1, 'Vehicle is required.'),
    paxCount: z.coerce.number().int().min(1).max(50),
    clientRef: z.string().min(1, 'Customer is required.'),
    billing: z.enum([TripEntityBilling.ACCOUNT, TripEntityBilling.CASH, TripEntityBilling.CARD]),
    passengerName: z.string().min(1, 'Passenger name is required.'),
    pickupLocation: z.string().min(1, 'Pickup location is required.'),
    dropoffLocation: z.string().optional(),
    instructions: z.string().optional(),
    pocName: z.string().optional(),
    pocPhone: z.string().optional(),
    driverRef: z.string().optional(),
    fleetRegNbr: z.string().optional(),
    subContractor: z.boolean().default(false),
    partnerRef: z.string().optional(),
    priceEur: z.coerce.number().min(0).optional(),
    partnerRateEur: z.coerce.number().min(0).optional(),
    tracking: z.boolean().default(true),
    flightNumber: z.string().optional(),
    bufferTime: z.coerce.number().int().optional(),
    fboAddress: z.string().optional(),
    tailNbr: z.string().optional(),
    pickupIata: z.string().optional(),
    dropoffIata: z.string().optional(),
    pickupTimezone: z.string().optional(),
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
    if (data.service === TripEntityService.SPEC && !data.instructions?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['instructions'],
        message: 'Instructions are required for a SPEC service.',
      })
    }
  })

export type TripFormValues = z.infer<typeof tripFormSchema>

export function tripFormDefaults(): TripFormValues {
  return {
    countryCode: '',
    area: 'Local',
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
    priceEur: undefined,
    partnerRateEur: undefined,
    tracking: true,
    flightNumber: '',
    bufferTime: undefined,
    fboAddress: '',
    tailNbr: '',
    pickupIata: '',
    dropoffIata: '',
    pickupTimezone: '',
    notifyDriver: false,
  }
}
