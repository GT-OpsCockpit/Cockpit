export type RecordKind = 'client' | 'driver' | 'fleetVehicle';

/** One missing requirement, and every field it concerns. */
export interface FieldGap {
  fields: string[];
  message: string;
}

/**
 * Every field the rules read, and nothing else — the interface of the module,
 * stated as a type.
 *
 * All `unknown` and all optional on purpose: the two callers hold these
 * differently (the web's form values are strings and booleans; the API's DTO
 * merged over the stored row has Date objects), and "is it filled in" is the
 * only question asked of them.
 */
export interface RecordValues {
  // Account
  clientType?: unknown;
  company?: unknown;
  contactFirstName?: unknown;
  contactLastName?: unknown;
  eventStartDate?: unknown;
  eventEndDate?: unknown;
  // Driver
  eventsOnly?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  phone?: unknown;
  email?: unknown;
  // Fleet vehicle
  isLocal?: unknown;
  countryCode?: unknown;
  area?: unknown;
  partnerCompany?: unknown;
  // The "Link to an Event" popup, shared by drivers and vehicles — and, under
  // eventCountry/eventArea, by the Events account's own date-and-place block.
  eventCountry?: unknown;
  eventArea?: unknown;
  eventRef?: unknown;
}

export function missingFields(kind: RecordKind, values: RecordValues): FieldGap[];
