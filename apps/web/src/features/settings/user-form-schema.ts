import { z } from 'zod'
import { isValidEmail } from '@cockpit/shared'
import { CreateUserDtoRole } from '@cockpit/shared/api'

const ROLE = z.enum([CreateUserDtoRole.ADMIN, CreateUserDtoRole.DISPATCHER])

const baseShape = {
  email: z
    .string()
    .min(1, 'Email is required.')
    .refine((v) => isValidEmail(v), { message: 'Enter a valid email address.' }),
  role: ROLE,
  firstName: z.string().min(1, 'Surname is required.'),
  lastName: z.string().min(1, 'Name is required.'),
  phone: z.string().optional(),
}

/** Mirrors CreateUserDto exactly (apps/api/src/users/dto/create-user.dto.ts) — email/role/firstName/lastName required, phone optional, password min 8. */
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
