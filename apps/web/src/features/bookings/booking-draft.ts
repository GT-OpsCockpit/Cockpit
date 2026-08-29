import type { CountryEntity, FboLookupEntity, GeocodeTzEntity, VehicleTypeEntity } from '@cockpit/shared/api'
import type { TripFormValues } from './trip-form-schema'

/**
 * What editing one field of the booking form does to the others.
 *
 * trip-form-rules.ts holds the *derivations* — what applies, what is locked,
 * the hints. This holds the *cascades*: the rules that rewrite a field when
 * another changes. They used to live one per onChange handler inside
 * TripFormFields' JSX, which meant none of them could be reached from a unit
 * test — only from a Playwright run that boots the whole app. That is the
 * wrong way round: a cascade that blanks a downstream field is exactly the
 * class of defect this project has already met twice.
 *
 * The network calls stay in the component: this module is handed the result
 * that came back, never the request. We extract the decision, not the I/O.
 */

/** Everything the cascades read from the meta endpoint, passed in — never fetched here. */
export interface BookingMeta {
  countries: CountryEntity[]
  vehicleTypes: VehicleTypeEntity[]
}

export type BookingChange =
  | { kind: 'countryCode'; value: string }
  | { kind: 'vehicleType'; value: string }
  | { kind: 'subContractor'; value: boolean }
  | {
      kind: 'geocode'
      field: 'pickupLocation' | 'dropoffLocation'
      result: GeocodeTzEntity
      /** The FBO directory's answer, when the component looked it up. */
      fbo?: FboLookupEntity
    }

/**
 * The patch to apply on top of the current values — not the whole draft.
 *
 * A patch is what makes the rule assertable as a value: "changing the country
 * clears the area" is one entry in an object, where the same rule expressed as
 * a setValue call can only be observed by rendering the form.
 */
export function applyBookingEdit(
  values: TripFormValues,
  change: BookingChange,
  meta: BookingMeta,
): Partial<TripFormValues> {
  switch (change.kind) {
    case 'countryCode': {
      const country = meta.countries.find((c) => c.code === change.value)
      return {
        ...(country && { pickupTimezone: country.tz }),
        // "Local" is France-only and a city belongs to one country, so an Area
        // already on file is now invalid — force a fresh pick rather than let
        // it silently rot (legacy resetAreaField, common.js:871).
        area: '',
      }
    }

    case 'vehicleType': {
      const vehicleType = meta.vehicleTypes.find((v) => v.name === change.value)
      // A smaller car cannot carry the party already entered; the count comes
      // down to what fits rather than being left impossible.
      if (!vehicleType || values.paxCount <= vehicleType.maxPax) return {}
      return { paxCount: vehicleType.maxPax }
    }

    case 'subContractor':
      // The two branches are mutually exclusive (see dispatchReadiness) and
      // only one is on screen at a time, so the one being left is cleared — an
      // off-screen driver would otherwise silently block Create & Dispatch.
      return change.value ? { driverRef: '', fleetRegNbr: '' } : { partnerRef: '' }

    case 'geocode': {
      const patch: Partial<TripFormValues> = {
        [change.field === 'pickupLocation' ? 'pickupIata' : 'dropoffIata']: change.result.iata ?? '',
      }
      if (change.field !== 'pickupLocation') return patch
      patch.pickupTimezone = change.result.tz
      // Airport pickup: pre-fill the handling agent's (FBO) address from the
      // directory, as the legacy's Flight info popup did (common.js:1544).
      // `found: false` just means this airport isn't in the directory yet —
      // the field stays editable, and an address already typed is never
      // overwritten.
      if (change.fbo?.found && change.fbo.fbo && !values.fboAddress?.trim()) {
        patch.fboAddress = change.fbo.fbo
      }
      return patch
    }
  }
}

export interface DispatchReadiness {
  canDispatch: boolean
  /** Why not — empty once it can. Never guessable from the greyed-out button alone. */
  blockedReason: string
}

/**
 * Whether this draft is ready to go straight out to a driver.
 *
 * Two independent ways to be ready: a Partner (farmed out), or a Driver with a
 * Fleet vehicle actually assigned. Both at once is a conflicting state,
 * blocked outright until the dispatcher clears one of the two — which is the
 * same exclusivity the `subContractor` cascade above maintains, and the reason
 * the two now live side by side.
 */
export function dispatchReadiness(values: TripFormValues): DispatchReadiness {
  const driverBranchOk = !!values.driverRef && !!values.fleetRegNbr
  const partnerBranchOk = !!values.subContractor && !!values.partnerRef
  const conflict = driverBranchOk && partnerBranchOk
  const canDispatch = !conflict && (driverBranchOk || partnerBranchOk)

  if (canDispatch) return { canDispatch: true, blockedReason: '' }
  return {
    canDispatch: false,
    blockedReason: conflict
      ? 'A driver and a partner are both assigned — clear one of the two.'
      : values.subContractor
        ? 'Pick the partner company this booking is farmed out to.'
        : 'Assign a driver and a fleet vehicle, or tick Sub-contracted and pick a partner.',
  }
}
