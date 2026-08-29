import { describe, expect, it } from 'vitest'
import { CreateUserDtoRole } from '@cockpit/shared/api'
import { userCreateFormDefaults, userCreateFormSchema, userEditFormSchema } from './user-form-schema'

function validCreate() {
  return {
    email: 'jane.doe@cockpit.test',
    password: 'password123',
    role: CreateUserDtoRole.DISPATCHER,
    firstName: 'Jane',
    lastName: 'Doe',
    phone: '+33611111111',
  }
}

describe('userCreateFormSchema — mirrors CreateUserDto', () => {
  it('accepts a fully valid user', () => {
    expect(userCreateFormSchema.safeParse(validCreate()).success).toBe(true)
  })

  it('rejects an all-empty form (userCreateFormDefaults())', () => {
    expect(userCreateFormSchema.safeParse(userCreateFormDefaults()).success).toBe(false)
  })

  it('rejects an invalid email format', () => {
    const result = userCreateFormSchema.safeParse({ ...validCreate(), email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('rejects a password under 8 characters', () => {
    const result = userCreateFormSchema.safeParse({ ...validCreate(), password: 'short1' })
    expect(result.success).toBe(false)
  })

  it('accepts an 8-character password (the boundary)', () => {
    expect(userCreateFormSchema.safeParse({ ...validCreate(), password: '12345678' }).success).toBe(true)
  })

  it.each(['firstName', 'lastName'] as const)('rejects with %s blank', (field) => {
    const result = userCreateFormSchema.safeParse({ ...validCreate(), [field]: '' })
    expect(result.success).toBe(false)
  })

  // The legacy refused an access account with no mobile, on create and on edit
  // alike (server.js:262-264, 275-277) — it is how a dispatcher is reached
  // off-hours.
  it('requires a phone', () => {
    expect(userCreateFormSchema.safeParse({ ...validCreate(), phone: '' }).success).toBe(false)
  })
})

describe('userEditFormSchema — mirrors UpdateUserDto (same as create, minus password)', () => {
  it('accepts a fully valid edit, with no password field at all', () => {
    const { password: _password, ...edit } = validCreate()
    expect(userEditFormSchema.safeParse(edit).success).toBe(true)
  })

  it('rejects an invalid email format', () => {
    const { password: _password, ...edit } = validCreate()
    expect(userEditFormSchema.safeParse({ ...edit, email: 'not-an-email' }).success).toBe(false)
  })

  it('requires a phone on edit too', () => {
    const { password: _password, ...edit } = validCreate()
    expect(userEditFormSchema.safeParse({ ...edit, phone: '' }).success).toBe(false)
  })
})
