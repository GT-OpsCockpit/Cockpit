/**
 * A valid POST /api/drivers body, for the many specs that need *a* driver
 * rather than a particular one.
 *
 * Every roster rule this app enforces lands on this payload, and each new one
 * would otherwise mean editing several dozen inline `.send({...})` calls
 * across five spec files — which is exactly what adding the Country
 * requirement cost. A spec that is *about* a field still spells it out
 * inline; this is for the rest.
 */
export function driverPayload(overrides: Record<string, unknown> = {}) {
  return {
    countryCode: 'FR',
    firstName: 'Bob',
    lastName: 'Driver',
    phone: '+33622222222',
    ...overrides,
  };
}
