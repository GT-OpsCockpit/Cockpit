import { z } from 'zod'
import { CreateUserDtoRole } from '@cockpit/shared/api'
import { requiredEmail, requiredPhone } from '@/lib/contact-fields'

const ROLE = z.enum([CreateUserDtoRole.ADMIN, CreateUserDtoRole.DISPATCHER])

const baseShape = {
  email: requiredEmail('Email is required.'),
  role: ROLE,
  firstName: z.string().min(1, 'Surname is required.'),
  lastName: z.string().min(1, 'Name is required.'),
  phone: requiredPhone('Mobile is required.'),
}

/** Mirrors CreateUserDto exactly (apps/api/src/users/dto/create-user.dto.ts) — email/role/firstName/lastName/phone required, password min 8. */
export const userCreateFormSchema = z.object({
  ...baseShape,
  password: z.string().min(8, 'Password must be at least 8 characters.'),
})

/** Mirrors UpdateUserDto exactly — same required fields as create, minus password (not editable after creation). */
export const userEditFormSchema = z.object(baseShape)

export type UserCreateFormValues = z.infer<typeof userCreateFormSchema>
export type UserEditFormValues = z.infer<typeof userEditFormSchema>

export function userCreateFormDefaults(): UserCreateFormValues {
  return { email: '', password: '', role: CreateUserDtoRole.DISPATCHER, firstName: '', lastName: '', phone: '' }
}
