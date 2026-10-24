import { z } from 'zod'
import { optionalEmail, optionalPhone } from '@/lib/contact-fields'

export const passengerFormSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: optionalPhone(),
  email: optionalEmail(),
  notes: z.string().optional(),
  /** Empty string = independent, not attached to any client. */
  clientRef: z.string().optional(),
})

export type PassengerFormValues = z.infer<typeof passengerFormSchema>

export function passengerFormDefaults(): PassengerFormValues {
  return {
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    notes: '',
    clientRef: '',
  }
}
