import type { CreateUserDto, PublicUserEntity, UpdateUserDto } from '@cockpit/shared/api'
import type { UserCreateFormValues, UserEditFormValues } from './user-form-schema'

export function userToFormValues(user: PublicUserEntity): UserEditFormValues {
  return {
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone ?? '',
  }
}

export function toCreateUserDto(values: UserCreateFormValues): CreateUserDto {
  return {
    email: values.email,
    password: values.password,
    role: values.role,
    firstName: values.firstName,
    lastName: values.lastName,
    phone: values.phone || undefined,
  }
}

export function toUpdateUserDto(values: UserEditFormValues): UpdateUserDto {
  return {
    email: values.email,
    role: values.role,
    firstName: values.firstName,
    lastName: values.lastName,
    phone: values.phone || undefined,
  }
}
