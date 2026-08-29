import { Billing, Service } from '../../../generated/prisma/enums';
import { compatibleFleetCategories } from '../constants/vehicle-compatibility';
import { normalizePhone } from '../utils/normalize-phone';

/**
 * What a booking's own columns are, given what the dispatcher typed and the
 * records it points at: which payloads are refused, which vehicle may service
 * it, whose phone the POC ends up being, and the ~26 columns create() and
 * update() write identically.
 *
 * Extracted from TripsService.resolveTripInputs(), which interleaved these
 * rules with the four lookups they need — so the only way to assert any of
 * them was an HTTP round trip against a real database. The lookups stay in the
 * service; the decisions are here, as values.
 *
 * Pure on purpose, like trip-assignment: nothing is read from the database,
 * and a refusal is returned rather than thrown. The caller turns it into the
 * HTTP exception its route owes (TripsService.toException).
 *
 * The checks run in the order they were written in, so a doubly-invalid
 * payload still reports the error it always reported.
 */

/** Every refusal here is a bad payload — none of them is a permission. */
export interface BookingFieldsRefusal {
  kind: 'invalid';
  message: string;
}

/** The dto fields the rules read — CreateTripDto and UpdateTripDto both satisfy it. */
export interface BookingFieldsDto {
  countryCode: string;
  area?: string;
  pickupAt: string;
  pickupLocation: string;
  dropoffLocation?: string;
  service: Service;
  hours?: number;
  instructions?: string;
  passengerName: string;
  pocName?: string;
  pocPhone?: string;
  tracking?: boolean;
  paxCount?: number;
  vehicleType?: string;
  fleetRegNbr?: string;
  priceEur?: number;
  partnerRateEur?: number;
  driverRef?: string;
  billing?: Billing;
  flightNumber?: string;
  bufferTime?: number;
  fboAddress?: string;
  tailNbr?: string;
  nameboard?: string;
  pickupIata?: string;
  dropoffIata?: string;
}

/** The account the booking is for, as far as these rules are concerned. */
export interface BookingClient {
  id: string;
  pocName: string | null;
  pocPhone: string | null;
  billing: Billing | null;
}

export interface BookingFleetVehicle {
  id: string;
  regNbr: string;
  category: { name: string };
}

/**
 * The records the dto points at, already looked up by the caller. A `null`
 * means "not found" for anything the dto named, and "not asked for" otherwise
 * — the rules below tell the two apart from the dto itself.
 */
export interface BookingFieldsDeps<TClient extends BookingClient> {
  client: TClient | null;
  driver: { id: string } | null;
  vehicleType: { id: string; maxPax: number } | null;
  fleetVehicle: BookingFleetVehicle | null;
  countryInfo: { defaultTimezone: string | null } | null;
  /**
   * The vehicle reserved for the driver being assigned, or null. The caller
   * only looks it up when shouldHonourReservedVehicle() says the reservation
   * applies at all.
   */
  reservedVehicle: { id: string } | null;
}

/** The columns create() and update() both write. */
export interface BookingColumns {
  countryCode: string;
  area: string;
  timezone: string | null;
  pickupAt: Date;
  pickupLocation: string;
  dropoffLocation: string | null;
  service: Service;
  hours: number | null;
  instructions: string | null;
  clientId: string;
  passengerName: string;
  pocName: string;
  pocPhone: string;
  tracking: boolean;
  paxCount: number | null;
  vehicleTypeId: string | null;
  fleetVehicleId: string | null;
  priceEur: number | null;
  partnerRateEur: number | null;
  billing: Billing | null;
  flightNumber: string | null;
  bufferTime: number | null;
  fboAddress: string | null;
  tailNbr: string | null;
  nameboard: string | null;
  pickupIata: string | null;
  dropoffIata: string | null;
}

export type BookingFields<TClient extends BookingClient> =
  | { refusal: BookingFieldsRefusal }
  | {
      refusal: null;
      /** Handed back so the caller keeps the narrowed record it looked up. */
      client: TClient;
      driverId: string | null;
      data: BookingColumns;
    };

function invalid(message: string): { refusal: BookingFieldsRefusal } {
  return { refusal: { kind: 'invalid', message } };
}

export function resolveBookingFields<TClient extends BookingClient>(
  dto: BookingFieldsDto,
  deps: BookingFieldsDeps<TClient>,
): BookingFields<TClient> {
  const { client, driver, vehicleType, fleetVehicle, countryInfo } = deps;

  if (dto.service !== Service.ASD && !dto.dropoffLocation) {
    return invalid('dropoffLocation is required (except for an ASD service)');
  }
  if (dto.service === Service.ASD) {
    if (dto.hours === undefined || dto.hours < 2 || dto.hours > 48) {
      return invalid(
        'hours (Nb H) is required for an ASD service, between 2 and 48',
      );
    }
  }
  if (dto.service === Service.SPEC && !dto.instructions?.trim()) {
    return invalid('instructions is required for a SPEC service');
  }

  // Unlike the legacy (which stored any free-text vehicleType string with
  // no existence check), vehicleTypeId is a real FK here: an unresolvable
  // name must be rejected rather than silently dropped.
  if (dto.vehicleType && !vehicleType) {
    return invalid(
      `vehicleType "${dto.vehicleType}" does not match an existing vehicle type`,
    );
  }
  if (vehicleType && dto.paxCount && dto.paxCount > vehicleType.maxPax) {
    return invalid(
      `${dto.vehicleType} accepts a maximum of ${vehicleType.maxPax} passengers.`,
    );
  }

  let autoInstructionsNote: string | null = null;
  if (dto.fleetRegNbr?.trim()) {
    if (!fleetVehicle) {
      return invalid(`No Fleet vehicle with registration "${dto.fleetRegNbr}"`);
    }
    if (dto.vehicleType) {
      const incompatible = refuseIncompatibleFleetVehicle(
        dto.vehicleType,
        fleetVehicle,
      );
      if (incompatible) return { refusal: incompatible };
      if (dto.vehicleType === 'Lugg.' && fleetVehicle.category.name === 'Van') {
        autoInstructionsNote = 'Need to remove seats';
      }
    }
  }

  if (!client) {
    return invalid(
      'clientRef is required and must match an existing client account',
    );
  }

  const resolvedPocPhone = normalizePhone(dto.pocPhone) || client.pocPhone;
  if (!resolvedPocPhone) {
    return invalid(
      'No POC phone: set it on the client account or for this trip.',
    );
  }

  if (dto.driverRef && !driver) {
    return invalid(
      `driverRef "${dto.driverRef}" does not match an existing driver`,
    );
  }

  let resolvedInstructions = dto.instructions || null;
  if (autoInstructionsNote) {
    const base = (dto.instructions ?? '').trim();
    if (!base.includes(autoInstructionsNote)) {
      resolvedInstructions = base
        ? `${base} — ${autoInstructionsNote}`
        : autoInstructionsNote;
    }
  }

  return {
    refusal: null,
    client,
    driverId: driver?.id ?? null,
    data: {
      countryCode: dto.countryCode,
      area: dto.area?.trim() || 'Local',
      timezone: countryInfo?.defaultTimezone ?? null,
      pickupAt: new Date(dto.pickupAt),
      pickupLocation: dto.pickupLocation,
      dropoffLocation: dto.dropoffLocation || null,
      service: dto.service,
      hours: dto.service === Service.ASD ? (dto.hours ?? null) : null,
      instructions: resolvedInstructions,
      clientId: client.id,
      passengerName: dto.passengerName,
      pocName: dto.pocName?.trim() || client.pocName || dto.passengerName,
      pocPhone: resolvedPocPhone,
      tracking: dto.tracking !== false,
      paxCount: dto.paxCount ?? null,
      vehicleTypeId: vehicleType?.id ?? null,
      fleetVehicleId: fleetVehicle?.id ?? deps.reservedVehicle?.id ?? null,
      priceEur: dto.priceEur ?? null,
      partnerRateEur: dto.partnerRateEur ?? null,
      billing: dto.billing ?? client.billing ?? null,
      flightNumber: dto.flightNumber || null,
      bufferTime: dto.bufferTime ?? null,
      fboAddress: dto.fboAddress || null,
      tailNbr: dto.tailNbr || null,
      nameboard: dto.nameboard || null,
      pickupIata: dto.pickupIata || null,
      dropoffIata: dto.dropoffIata || null,
    },
  };
}

/** Fleet category ↔ vehicle type rule — same check on create, update and assign. */
export function refuseIncompatibleFleetVehicle(
  vehicleTypeName: string,
  fleetVehicle: BookingFleetVehicle,
): BookingFieldsRefusal | null {
  const allowed = compatibleFleetCategories(vehicleTypeName);
  if (allowed.includes(fleetVehicle.category.name)) return null;
  return {
    kind: 'invalid',
    message: `Vehicle ${fleetVehicle.regNbr} (${fleetVehicle.category.name}) cannot service a ${vehicleTypeName} trip — compatible categories: ${allowed.join(', ')}`,
  };
}

/**
 * Whether this driver's reserved fleet vehicle applies to the booking being
 * written — the padlock on Drivers & Partners.
 *
 * A partner chauffeur can have one fleet vehicle reserved for them, and
 * assigning that chauffeur to a booking without naming a vehicle honours the
 * reservation instead of leaving it informational — the legacy did this
 * client-side in two places (autoAssignLinkedVehicleInBookingBar for the New
 * booking bar, quickUpdateTrip for every later reassignment).
 *
 * Only when the driver is actually being (re)assigned, never on an unrelated
 * edit — otherwise deliberately clearing the Reg Nbr on a booking would
 * silently re-add the reserved vehicle on every save. And never over a Reg Nbr
 * the dispatcher named themselves.
 *
 * Answered here rather than at each write path because create/update and the
 * Planning drag & drop (assign) each used to carry their own copy of it.
 */
export function shouldHonourReservedVehicle({
  driverId,
  previousDriverId,
  fleetRegNbr,
}: {
  driverId: string | null;
  previousDriverId?: string | null;
  fleetRegNbr?: string | null;
}): boolean {
  return !!driverId && driverId !== previousDriverId && !fleetRegNbr?.trim();
}
