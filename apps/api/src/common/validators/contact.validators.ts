import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';
import { isValidEmail, isValidPhone, normalizeEmail } from '@cockpit/shared';
import { COUNTRIES } from '../constants/countries';

/**
 * Format validators for the three values that identify a person or a place —
 * all delegating to @cockpit/shared, so the API and the web forms can't drift
 * into accepting different strings.
 *
 * Not class-validator's own @IsEmail(): its regex disagrees with the shared
 * one on edge cases, which is the exact drift validation/email.js exists to
 * prevent. And there is no @IsPhoneNumber equivalent here at all — the
 * built-in one accepts a national number given a region, which is what let
 * undialable numbers into the database in the first place.
 */

/** A complete phone number in E.164 ("+33612345678"). */
export function IsPhone(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isPhone',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && isValidPhone(value),
        defaultMessage: (args: ValidationArguments) =>
          `${args.property} must be a valid phone number in international format (e.g. +33612345678)`,
      },
    });
  };
}

function IsEmailFormatOnly(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isEmailFormat',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && isValidEmail(value),
        defaultMessage: (args: ValidationArguments) =>
          `${args.property} must be a valid email address`,
      },
    });
  };
}

/**
 * A syntactically valid email address, trimmed and lowercased first.
 *
 * Normalizing before validating (rather than in each service, as ClientsService
 * and UsersService did) means "  Jane.Doe@Example.com  " is accepted and stored
 * as "jane.doe@example.com" — one spelling per address, so the unique indexes
 * and the login lookup can't be defeated by capitalization or a stray space.
 */
export function IsEmailFormat(options?: ValidationOptions) {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? normalizeEmail(value) : value,
    ),
    IsEmailFormatOnly(options),
  );
}

const COUNTRY_CODES = new Set(COUNTRIES.map((country) => country.code));

/**
 * A code from the app's own catalogue — including its split pseudo-codes
 * ('US-NY', 'AU-NSW'), which are what Country.code, the driver ref prefixes
 * and the Area suggestions are all keyed by.
 *
 * Nothing checked this before, so an unknown code was accepted and silently
 * produced a trip with `timezone: null` (TripsService.create) and, now, a
 * blank flag in the UI.
 */
export function IsCountryCode(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isCountryCode',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && COUNTRY_CODES.has(value),
        defaultMessage: (args: ValidationArguments) =>
          `${args.property} must be a known country code`,
      },
    });
  };
}
