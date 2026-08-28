import { z } from 'zod'
import { isValidEmail, isValidPhone } from '@cockpit/shared'

/**
 * Phone and email zod fields, shared by every form so the rules can't drift
 * between them — and so they keep mirroring the API's own validators
 * (apps/api/src/common/validators), which call the same @cockpit/shared
 * predicates.
 *
 * "Optional" means optional, not lax: an empty field passes, a filled one has
 * to be a real value. A phone is required to be E.164 because that is what the
 * API stores and what Twilio dials — <PhoneInput> always produces it.
 */
const PHONE_MESSAGE = 'Enter a valid phone number, including its country code.'
const EMAIL_MESSAGE = 'Enter a valid email address.'

export const optionalPhone = () =>
  z
    .string()
    .optional()
    .refine((value) => !value?.trim() || isValidPhone(value.trim()), { message: PHONE_MESSAGE })

export const requiredPhone = (missingMessage: string) =>
  z
    .string()
    .min(1, missingMessage)
    .refine((value) => isValidPhone(value.trim()), { message: PHONE_MESSAGE })

export const optionalEmail = () =>
  z
    .string()
    .optional()
    .refine((value) => !value?.trim() || isValidEmail(value.trim()), { message: EMAIL_MESSAGE })

export const requiredEmail = (missingMessage: string) =>
  z
    .string()
    .min(1, missingMessage)
    .refine((value) => isValidEmail(value.trim()), { message: EMAIL_MESSAGE })
