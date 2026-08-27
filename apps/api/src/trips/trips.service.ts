import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import { can } from '../common/permissions/permissions';
import type { AuthenticatedUser } from '../common/guards/session-auth.guard';
import { TripRefService } from './trip-ref.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NAMEBOARD_URL_PREFIX } from './nameboard-upload.config';
import { normalizePhone } from '../common/utils/normalize-phone';
import { computeDriverName } from '../common/utils/driver-name';
import { compatibleFleetCategories } from '../common/constants/vehicle-compatibility';
import { MESSAGES } from '../common/constants/messages';
import { FULL_STEP_ORDER } from '../common/constants/step-order';
import { buildTripMessageContext } from './trip-message.util';
import { toPublicTrip } from './public-trip.mapper';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { AssignTripDto } from './dto/assign-trip.dto';
import { CancelAssignmentDto } from './dto/cancel-assignment.dto';
import { DRIVER_STEP_VALUES } from './dto/notify-step.dto';
import { ListTripsQueryDto, type TripPeriod } from './dto/list-trips-query.dto';
import {
  CancellationFee,
  ClientType,
  Service,
  TripStepKind,
} from '../../generated/prisma/enums';
import {
  TripEntity,
  UpdateTripResponseEntity,
  CancelAssignmentResponseEntity,
  TripActionResponseEntity,
} from './dto/trip.entity';
import {
  PublicTripEntity,
  PublicTripActionResponseEntity,
} from './dto/public-trip.entity';

const TRIP_INCLUDE = {
  client: true,
  driver: true,
  partner: true,
  vehicleType: true,
  fleetVehicle: { include: { category: true } },
  steps: true,
} as const;

// Single source of truth for "what's in view" on the Bookings board — this
// used to be recomputed client-side (isPastDay/periodMatches/baseVisibility
// in apps/web's trip-status.ts) against a full, ever-growing, unfiltered
// fetch. Same reference zone as the legacy header / the urgency highlight.
const PARIS_ZONE = 'Europe/Paris';

/** Date range for the user-facing period filter — `null` means "no bound" (period 'all'). */
function periodDateRange(
  period: TripPeriod,
  nowParis: DateTime,
): Prisma.DateTimeFilter | null {
  switch (period) {
    case 'all':
      return null;
    case 'today': {
      const start = nowParis.startOf('day');
      return { gte: start.toJSDate(), lt: start.plus({ days: 1 }).toJSDate() };
    }
    case 'week': {
      const start = nowParis.startOf('week');
      return { gte: start.toJSDate(), lt: start.plus({ weeks: 1 }).toJSDate() };
    }
    case 'upcoming':
      return { gte: nowParis.toJSDate() };
    case 'past':
      return { lt: nowParis.toJSDate() };
  }
}

const STEP_MESSAGE_KEY: Record<
  (typeof DRIVER_STEP_VALUES)[number],
  'accepted' | 'enroute' | 'arrived' | 'onboard' | 'dropped'
> = {
  ACCEPTED: 'accepted',
  ENROUTE: 'enroute',
  ARRIVED: 'arrived',
  ONBOARD: 'onboard',
  DROPPED: 'dropped',
};

@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tripRef: TripRefService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
  ) {}

  list(query: ListTripsQueryDto): Promise<TripEntity[]> {
    const period = query.period ?? 'upcoming';
    const category = query.category ?? 'daily';
    const nowParis = DateTime.now().setZone(PARIS_ZONE);

    // Unconditional (independent of `period`): a trip whose pickup was
    // before *today* (Paris) drops out of view once it still has no driver
    // — it's an unresolved needs-attention case, not clutter. Same rule the
    // legacy showed by never letting a booking scroll off the live board.
    const where: Prisma.TripWhereInput = {
      OR: [
        { pickupAt: { gte: nowParis.startOf('day').toJSDate() } },
        { driverId: null },
      ],
    };
    if (category === 'daily') {
      where.client = { clientType: { not: ClientType.EVENT } };
    } else if (category === 'event') {
      where.client = { clientType: ClientType.EVENT };
    }
    const periodRange = periodDateRange(period, nowParis);
    if (periodRange) where.pickupAt = periodRange;

    return this.prisma.trip.findMany({
      where,
      include: TRIP_INCLUDE,
      orderBy: { pickupAt: 'asc' },
    });
  }

  async getPublic(
    ref: string,
    viewerIsDriver: boolean,
  ): Promise<PublicTripEntity> {
    const trip = await this.findByRefOrThrow(ref);
    const assigned = trip.driverId || trip.partnerId;
    if (
      viewerIsDriver &&
      assigned &&
      !trip.steps.some((s) => s.step === TripStepKind.RECEIVED)
    ) {
      const missingTransmitted = !trip.steps.some(
        (s) => s.step === TripStepKind.TRANSMITTED,
      );
      // skipDuplicates: two near-simultaneous opens of the driver link (React
      // StrictMode's double effect-invoke in dev reliably triggers this, and
      // nothing stops it happening for real with a flaky connection) can both
      // read "RECEIVED not yet present" and race to insert it — @@unique on
      // (tripId, step) then throws P2002 for the loser instead of the 200 it
      // should still get, since the desired end state (stamped) holds either
      // way.
      await this.prisma.tripStep.createMany({
        data: [
          ...(missingTransmitted
            ? [{ tripId: trip.id, step: TripStepKind.TRANSMITTED }]
            : []),
          { tripId: trip.id, step: TripStepKind.RECEIVED },
        ],
        skipDuplicates: true,
      });
      this.realtime.emitTripChanged(ref);
      return toPublicTrip(await this.findByRefOrThrow(ref), viewerIsDriver);
    }
    return toPublicTrip(trip, viewerIsDriver);
  }

  // TODO: the vehicleType/client/driver/partner/countryInfo lookups below
  // (and the equivalent block in update()) are independent of each other
  // and currently awaited one at a time — 5-6 sequential DB round trips per
  // call. Batch the independent ones with Promise.all to cut latency on
  // these hot dispatch-desk paths.
  async create(dto: CreateTripDto): Promise<TripEntity> {
    if (dto.service !== Service.ASD && !dto.dropoffLocation) {
      throw new BadRequestException(
        'dropoffLocation is required (except for an ASD service)',
      );
    }
    if (dto.service === Service.ASD) {
      if (dto.hours === undefined || dto.hours < 2 || dto.hours > 48) {
        throw new BadRequestException(
          'hours (Nb H) is required for an ASD service, between 2 and 48',
        );
      }
    }
    if (dto.service === Service.SPEC && !dto.instructions?.trim()) {
      throw new BadRequestException(
        'instructions is required for a SPEC service',
      );
    }

    const vehicleType = dto.vehicleType
      ? await this.prisma.vehicleType.findUnique({
          where: { name: dto.vehicleType },
        })
      : null;
    // Unlike the legacy (which stored any free-text vehicleType string with
    // no existence check), vehicleTypeId is a real FK here: an unresolvable
    // name must be rejected rather than silently dropped.
    if (dto.vehicleType && !vehicleType) {
      throw new BadRequestException(
        `vehicleType "${dto.vehicleType}" does not match an existing vehicle type`,
      );
    }
    if (vehicleType && dto.paxCount && dto.paxCount > vehicleType.maxPax) {
      throw new BadRequestException(
        `${dto.vehicleType} accepts a maximum of ${vehicleType.maxPax} passengers.`,
      );
    }

    let fleetVehicle: Awaited<
      ReturnType<typeof this.resolveFleetVehicle>
    > | null = null;
    let autoInstructionsNote: string | null = null;
    if (dto.fleetRegNbr?.trim()) {
      fleetVehicle = await this.resolveFleetVehicle(dto.fleetRegNbr);
      if (dto.vehicleType) {
        const allowed = compatibleFleetCategories(dto.vehicleType);
        if (!allowed.includes(fleetVehicle.category.name)) {
          throw new BadRequestException(
            `Vehicle ${fleetVehicle.regNbr} (${fleetVehicle.category.name}) cannot service a ${dto.vehicleType} trip — compatible categories: ${allowed.join(', ')}`,
          );
        }
        if (
          dto.vehicleType === 'Lugg.' &&
          fleetVehicle.category.name === 'Van'
        ) {
          autoInstructionsNote = 'Need to remove seats';
        }
      }
    }

    const client = await this.prisma.client.findUnique({
      where: { ref: dto.clientRef },
    });
    if (!client) {
      throw new BadRequestException(
        'clientRef is required and must match an existing client account',
      );
    }

    const resolvedPocPhone = normalizePhone(dto.pocPhone) || client.pocPhone;
    if (!resolvedPocPhone) {
      throw new BadRequestException(
        'No POC phone: set it on the client account or for this trip.',
      );
    }
    const resolvedPocName =
      dto.pocName?.trim() || client.pocName || dto.passengerName;
    const resolvedPocEmail = dto.pocEmail || client.pocEmail || null;

    const driver = dto.driverRef
      ? await this.prisma.driver.findUnique({ where: { ref: dto.driverRef } })
      : null;
    if (dto.driverRef && !driver) {
      throw new BadRequestException(
        `driverRef "${dto.driverRef}" does not match an existing driver`,
      );
    }
    const partner =
      dto.subContractor && dto.partnerRef
        ? await this.prisma.driver.findUnique({
            where: { ref: dto.partnerRef },
          })
        : null;
    if (dto.subContractor && dto.partnerRef && !partner) {
      throw new BadRequestException(
        `partnerRef "${dto.partnerRef}" does not match an existing driver`,
      );
    }

    let ref = dto.ref;
    if (ref) {
      const existing = await this.prisma.trip.findUnique({ where: { ref } });
      if (existing)
        throw new ConflictException(`A trip with ref. ${ref} already exists`);
    } else {
      ref = await this.tripRef.generate(client.ref);
    }

    const countryInfo = await this.prisma.country.findUnique({
      where: { code: dto.countryCode },
    });

    let resolvedInstructions = dto.instructions || null;
    if (autoInstructionsNote) {
      const base = (dto.instructions ?? '').trim();
      if (!base.includes(autoInstructionsNote)) {
        resolvedInstructions = base
          ? `${base} — ${autoInstructionsNote}`
          : autoInstructionsNote;
      }
    }

    const locked = !!dto.subContractor && !partner;

    await this.prisma.trip.create({
      data: {
        ref,
        countryCode: dto.countryCode,
        area: dto.area?.trim() || 'Local',
        timezone: countryInfo?.defaultTimezone ?? null,
        pickupAt: new Date(dto.pickupAt),
        pickupLocation: dto.pickupLocation,
        dropoffLocation: dto.dropoffLocation || null,
        service: dto.service,
        hours: dto.service === Service.ASD ? dto.hours : null,
        instructions: resolvedInstructions,
        clientId: client.id,
        passengerName: dto.passengerName,
        pocName: resolvedPocName,
        pocPhone: resolvedPocPhone,
        pocEmail: resolvedPocEmail,
        tracking: dto.tracking !== false,
        paxCount: dto.paxCount ?? null,
        vehicleTypeId: vehicleType?.id ?? null,
        fleetVehicleId: fleetVehicle?.id ?? null,
        priceEur: dto.priceEur ?? null,
        partnerRateEur: dto.partnerRateEur ?? null,
        driverId: driver?.id ?? null,
        billing: dto.billing ?? client.billing ?? null,
        flightNumber: dto.flightNumber || null,
        bufferTime: dto.bufferTime ?? null,
        fboAddress: dto.fboAddress || null,
        tailNbr: dto.tailNbr || null,
        pickupIata: dto.pickupIata || null,
        dropoffIata: dto.dropoffIata || null,
        subContractor: !!dto.subContractor,
        partnerId: partner?.id ?? null,
        dispatched: locked,
        steps: locked
          ? { create: [{ step: TripStepKind.TRANSMITTED }] }
          : undefined,
      },
    });
    this.realtime.emitTripChanged(ref);
    return this.findByRefOrThrow(ref);
  }

  async update(
    ref: string,
    dto: UpdateTripDto,
    user: AuthenticatedUser,
  ): Promise<UpdateTripResponseEntity> {
    const trip = await this.findByRefOrThrow(ref);

    // Ported from the legacy's openEditTripModal gate (common.js): editing a
    // booking whose pickup has already passed, or changing the Retail net /
    // Partner rate net, both need trip:edit-past / trip:edit-price — unlike
    // trip:cancel these are conditional, so they're checked here rather than
    // via @RequirePermission() on the route. See docs/agents/permissions.md.
    const isPast = trip.pickupAt < new Date();
    if (isPast && !can(user, 'trip:edit-past')) {
      throw new ForbiddenException(
        'Editing a booking whose pickup is already in the past requires the Admin role.',
      );
    }
    const priceChanged =
      (dto.priceEur ?? null) !==
      (trip.priceEur ? trip.priceEur.toNumber() : null);
    const partnerRateChanged =
      (dto.partnerRateEur ?? null) !==
      (trip.partnerRateEur ? trip.partnerRateEur.toNumber() : null);
    if ((priceChanged || partnerRateChanged) && !can(user, 'trip:edit-price')) {
      throw new ForbiddenException(
        'Changing the Retail net / Partner rate net requires the Admin role.',
      );
    }

    if (dto.service !== Service.ASD && !dto.dropoffLocation) {
      throw new BadRequestException(
        'dropoffLocation is required (except for an ASD service)',
      );
    }
    if (dto.service === Service.ASD) {
      if (dto.hours === undefined || dto.hours < 2 || dto.hours > 48) {
        throw new BadRequestException(
          'hours (Nb H) is required for an ASD service, between 2 and 48',
        );
      }
    }
    if (dto.service === Service.SPEC && !dto.instructions?.trim()) {
      throw new BadRequestException(
        'instructions is required for a SPEC service',
      );
    }

    const vehicleType = dto.vehicleType
      ? await this.prisma.vehicleType.findUnique({
          where: { name: dto.vehicleType },
        })
      : null;
    // Unlike the legacy (which stored any free-text vehicleType string with
    // no existence check), vehicleTypeId is a real FK here: an unresolvable
    // name must be rejected rather than silently dropped.
    if (dto.vehicleType && !vehicleType) {
      throw new BadRequestException(
        `vehicleType "${dto.vehicleType}" does not match an existing vehicle type`,
      );
    }
    if (vehicleType && dto.paxCount && dto.paxCount > vehicleType.maxPax) {
      throw new BadRequestException(
        `${dto.vehicleType} accepts a maximum of ${vehicleType.maxPax} passengers.`,
      );
    }

    let fleetVehicle: Awaited<
      ReturnType<typeof this.resolveFleetVehicle>
    > | null = null;
    let autoInstructionsNote: string | null = null;
    if (dto.fleetRegNbr?.trim()) {
      fleetVehicle = await this.resolveFleetVehicle(dto.fleetRegNbr);
      if (dto.vehicleType) {
        const allowed = compatibleFleetCategories(dto.vehicleType);
        if (!allowed.includes(fleetVehicle.category.name)) {
          throw new BadRequestException(
            `Vehicle ${fleetVehicle.regNbr} (${fleetVehicle.category.name}) cannot service a ${dto.vehicleType} trip — compatible categories: ${allowed.join(', ')}`,
          );
        }
        if (
          dto.vehicleType === 'Lugg.' &&
          fleetVehicle.category.name === 'Van'
        ) {
          autoInstructionsNote = 'Need to remove seats';
        }
      }
    }

    const client = await this.prisma.client.findUnique({
      where: { ref: dto.clientRef },
    });
    if (!client) {
      throw new BadRequestException(
        'clientRef is required and must match an existing client account',
      );
    }

    const resolvedPocPhone = normalizePhone(dto.pocPhone) || client.pocPhone;
    if (!resolvedPocPhone) {
      throw new BadRequestException(
        'No POC phone: set it on the client account or for this trip.',
      );
    }
    const resolvedPocName =
      dto.pocName?.trim() || client.pocName || dto.passengerName;

    let resolvedInstructions = dto.instructions || null;
    if (autoInstructionsNote) {
      const base = (dto.instructions ?? '').trim();
      if (!base.includes(autoInstructionsNote)) {
        resolvedInstructions = base
          ? `${base} — ${autoInstructionsNote}`
          : autoInstructionsNote;
      }
    }

    const driver = dto.driverRef
      ? await this.prisma.driver.findUnique({ where: { ref: dto.driverRef } })
      : null;
    if (dto.driverRef && !driver) {
      throw new BadRequestException(
        `driverRef "${dto.driverRef}" does not match an existing driver`,
      );
    }
    const countryInfo = await this.prisma.country.findUnique({
      where: { code: dto.countryCode },
    });

    const previousDriverId = trip.driverId;
    const newDriverId = driver?.id ?? null;
    const previousPartnerId = trip.partnerId;

    let newRef = trip.ref;
    if (client.id !== trip.clientId) {
      newRef = await this.tripRef.generate(client.ref);
      await this.tripRef.release(trip.ref);
    }

    let partnerId: string | null | undefined;
    if (dto.partnerRef !== undefined) {
      const partner = dto.partnerRef
        ? await this.prisma.driver.findUnique({
            where: { ref: dto.partnerRef },
          })
        : null;
      if (dto.partnerRef && !partner) {
        throw new BadRequestException(
          `partnerRef "${dto.partnerRef}" does not match an existing driver`,
        );
      }
      partnerId = partner?.id ?? null;
    }
    const finalPartnerId =
      partnerId !== undefined ? partnerId : previousPartnerId;
    const reassigned =
      newDriverId !== previousDriverId || finalPartnerId !== previousPartnerId;
    const finalSubContractor =
      dto.subContractor !== undefined ? dto.subContractor : trip.subContractor;
    const locked = finalSubContractor && !finalPartnerId;
    const dispatchedValue = locked
      ? true
      : reassigned
        ? false
        : trip.dispatched;

    await this.prisma.trip.update({
      where: { id: trip.id },
      data: {
        ref: newRef,
        countryCode: dto.countryCode,
        area: dto.area?.trim() || 'Local',
        timezone: countryInfo?.defaultTimezone ?? null,
        pickupAt: new Date(dto.pickupAt),
        pickupLocation: dto.pickupLocation,
        dropoffLocation: dto.dropoffLocation || null,
        service: dto.service,
        hours: dto.service === Service.ASD ? dto.hours : null,
        instructions: resolvedInstructions,
        clientId: client.id,
        passengerName: dto.passengerName,
        pocName: resolvedPocName,
        pocPhone: resolvedPocPhone,
        tracking: dto.tracking !== false,
        paxCount: dto.paxCount ?? null,
        vehicleTypeId: vehicleType?.id ?? null,
        fleetVehicleId: fleetVehicle?.id ?? null,
        priceEur: dto.priceEur ?? null,
        partnerRateEur: dto.partnerRateEur ?? null,
        driverId: newDriverId,
        billing: dto.billing ?? client.billing ?? null,
        flightNumber: dto.flightNumber || null,
        bufferTime: dto.bufferTime ?? null,
        fboAddress: dto.fboAddress || null,
        tailNbr: dto.tailNbr || null,
        pickupIata: dto.pickupIata || null,
        dropoffIata: dto.dropoffIata || null,
        ...(dto.subContractor !== undefined && {
          subContractor: dto.subContractor,
        }),
        ...(partnerId !== undefined && { partnerId }),
        dispatched: dispatchedValue,
        ...(reassigned && {
          assignmentCancelled: false,
          assignmentCancelledAt: null,
          cancellationFee: null,
        }),
      },
    });

    if (reassigned) {
      await this.prisma.tripStep.deleteMany({ where: { tripId: trip.id } });
    }
    if (locked && !(await this.hasStep(trip.id, TripStepKind.TRANSMITTED))) {
      await this.prisma.tripStep.create({
        data: { tripId: trip.id, step: TripStepKind.TRANSMITTED },
      });
    }

    let notifyWarning: string | null = null;
    if (dto.notifyDriver && newDriverId && dto.tracking !== false) {
      const full = await this.findByRefOrThrow(newRef);
      try {
        await this.notifications.send(
          full.pocPhone!,
          MESSAGES.updated(buildTripMessageContext(full)),
        );
      } catch (err) {
        notifyWarning = `Changes saved, but the update WhatsApp message failed to send: ${(err as Error).message}`;
      }
    }

    this.realtime.emitTripChanged(newRef);
    return {
      ok: true,
      trip: await this.findByRefOrThrow(newRef),
      notifyWarning,
    };
  }

  // Lightweight counterpart to update() for the Planning Gantt's drag&drop:
  // patches only driverRef and/or fleetRegNbr, deliberately kept independent
  // from update()'s much larger flow (client/price/ref regeneration, etc.)
  // rather than extracted from it — see docs/handoff for the Planning session.
  async assign(
    ref: string,
    dto: AssignTripDto,
    user: AuthenticatedUser,
  ): Promise<TripActionResponseEntity> {
    const trip = await this.findByRefOrThrow(ref);

    const isPast = trip.pickupAt < new Date();
    if (isPast && !can(user, 'trip:edit-past')) {
      throw new ForbiddenException(
        'Reassigning a booking whose pickup is already in the past requires the Admin role.',
      );
    }

    const data: Prisma.TripUpdateInput = {};

    if (dto.driverRef !== undefined) {
      const driver = dto.driverRef
        ? await this.prisma.driver.findUnique({ where: { ref: dto.driverRef } })
        : null;
      if (dto.driverRef && !driver) {
        throw new BadRequestException(
          `driverRef "${dto.driverRef}" does not match an existing driver`,
        );
      }
      const newDriverId = driver?.id ?? null;
      if (newDriverId !== trip.driverId) {
        data.driver = newDriverId
          ? { connect: { id: newDriverId } }
          : { disconnect: true };
        data.dispatched = false;
        data.assignmentCancelled = false;
        data.assignmentCancelledAt = null;
        data.cancellationFee = null;
      }
    }

    if (dto.fleetRegNbr !== undefined) {
      const fleetVehicle = dto.fleetRegNbr
        ? await this.resolveFleetVehicle(dto.fleetRegNbr)
        : null;
      if (fleetVehicle && trip.vehicleType) {
        const allowed = compatibleFleetCategories(trip.vehicleType.name);
        if (!allowed.includes(fleetVehicle.category.name)) {
          throw new BadRequestException(
            `Vehicle ${fleetVehicle.regNbr} (${fleetVehicle.category.name}) cannot service a ${trip.vehicleType.name} trip — compatible categories: ${allowed.join(', ')}`,
          );
        }
      }
      data.fleetVehicle = fleetVehicle
        ? { connect: { id: fleetVehicle.id } }
        : { disconnect: true };
    }

    if (Object.keys(data).length === 0) {
      return { ok: true, trip };
    }

    await this.prisma.trip.update({ where: { id: trip.id }, data });
    if (data.dispatched === false) {
      await this.prisma.tripStep.deleteMany({ where: { tripId: trip.id } });
    }

    this.realtime.emitTripChanged(ref);
    return { ok: true, trip: await this.findByRefOrThrow(ref) };
  }

  async cancelAssignment(
    ref: string,
    dto: CancelAssignmentDto,
  ): Promise<CancelAssignmentResponseEntity> {
    const trip = await this.findByRefOrThrow(ref);
    if (!dto.cancellationFee || dto.cancellationFee === CancellationFee.FREE) {
      await this.prisma.$transaction([
        this.prisma.tripStep.deleteMany({ where: { tripId: trip.id } }),
        this.prisma.trip.delete({ where: { id: trip.id } }),
      ]);
      await this.tripRef.release(trip.ref);
      this.realtime.emitTripChanged(trip.ref);
      return { ok: true, deleted: true };
    }

    await this.prisma.$transaction([
      this.prisma.tripStep.deleteMany({ where: { tripId: trip.id } }),
      this.prisma.trip.update({
        where: { id: trip.id },
        data: {
          driverId: null,
          assignmentCancelled: true,
          assignmentCancelledAt: new Date(),
          cancellationFee: dto.cancellationFee,
        },
      }),
    ]);
    this.realtime.emitTripChanged(ref);
    return { ok: true, trip: await this.findByRefOrThrow(ref) };
  }

  async advanceStep(ref: string): Promise<TripActionResponseEntity> {
    const trip = await this.findByRefOrThrow(ref);
    if (trip.assignmentCancelled) {
      throw new BadRequestException(
        'This trip is cancelled (Stop status): reassign a driver before advancing the status.',
      );
    }
    if (trip.subContractor && !trip.partnerId) {
      throw new BadRequestException(
        'This job is sub-contracted to a company with no driver on file — status stays at Sent.',
      );
    }

    const present = new Set(trip.steps.map((s) => s.step));
    let currentIndex = -1;
    FULL_STEP_ORDER.forEach((key, i) => {
      if (present.has(key)) currentIndex = i;
    });
    const nextIndex = currentIndex + 1;
    if (nextIndex >= FULL_STEP_ORDER.length) {
      throw new BadRequestException(
        'This trip is already at its last status (Done).',
      );
    }
    const nextStep = FULL_STEP_ORDER[nextIndex];

    if (
      nextStep === TripStepKind.TRANSMITTED ||
      nextStep === TripStepKind.RECEIVED
    ) {
      await this.prisma.tripStep.create({
        data: { tripId: trip.id, step: nextStep },
      });
      this.realtime.emitTripChanged(ref);
      return { ok: true, trip: await this.findByRefOrThrow(ref) };
    }

    if (!trip.tracking) {
      await this.prisma.tripStep.create({
        data: { tripId: trip.id, step: nextStep },
      });
      this.realtime.emitTripChanged(ref);
      return {
        ok: true,
        trip: await this.findByRefOrThrow(ref),
        skipped: true,
      };
    }

    const body = MESSAGES[STEP_MESSAGE_KEY[nextStep]](
      buildTripMessageContext(trip),
    );
    try {
      await this.notifications.send(trip.pocPhone!, body);
    } catch (err) {
      throw new InternalServerErrorException((err as Error).message);
    }
    await this.prisma.tripStep.create({
      data: { tripId: trip.id, step: nextStep },
    });
    this.realtime.emitTripChanged(ref);
    return { ok: true, trip: await this.findByRefOrThrow(ref) };
  }

  async notify(
    ref: string,
    step: (typeof DRIVER_STEP_VALUES)[number],
  ): Promise<PublicTripActionResponseEntity> {
    const trip = await this.findByRefOrThrow(ref);
    if (trip.assignmentCancelled) {
      throw new BadRequestException(
        'This trip is cancelled (Stop status): status updates are no longer accepted.',
      );
    }

    if (!trip.tracking) {
      await this.stampStep(trip.id, TripStepKind[step]);
      this.realtime.emitTripChanged(ref);
      return {
        ok: true,
        trip: toPublicTrip(await this.findByRefOrThrow(ref), true),
        skipped: true,
      };
    }

    const body = MESSAGES[STEP_MESSAGE_KEY[step]](
      buildTripMessageContext(trip),
    );
    try {
      await this.notifications.send(trip.pocPhone!, body);
    } catch (err) {
      throw new InternalServerErrorException((err as Error).message);
    }
    await this.stampStep(trip.id, TripStepKind[step]);
    this.realtime.emitTripChanged(ref);
    return {
      ok: true,
      trip: toPublicTrip(await this.findByRefOrThrow(ref), true),
    };
  }

  async dispatchDriver(ref: string): Promise<TripEntity> {
    const trip = await this.findByRefOrThrow(ref);
    const assignee = trip.driver ?? trip.partner;
    if (!assignee)
      throw new BadRequestException(
        'No driver or partner assigned to this trip.',
      );
    if (!assignee.phone)
      throw new BadRequestException(
        'This driver/partner has no mobile number on file.',
      );

    const body = MESSAGES.driverDispatch(buildTripMessageContext(trip), {
      name: computeDriverName(assignee),
    });
    try {
      await this.notifications.send(assignee.phone, body);
    } catch (err) {
      throw new InternalServerErrorException((err as Error).message);
    }
    await this.prisma.trip.update({
      where: { id: trip.id },
      data: { dispatched: true },
    });
    if (!trip.steps.some((s) => s.step === TripStepKind.TRANSMITTED)) {
      await this.prisma.tripStep.create({
        data: { tripId: trip.id, step: TripStepKind.TRANSMITTED },
      });
    }
    this.realtime.emitTripChanged(ref);
    return this.findByRefOrThrow(ref);
  }

  async setNameboard(ref: string, filename: string): Promise<TripEntity> {
    const trip = await this.findByRefOrThrow(ref);
    await this.prisma.trip.update({
      where: { id: trip.id },
      data: { nameboardUrl: `${NAMEBOARD_URL_PREFIX}/${filename}` },
    });
    this.realtime.emitTripChanged(ref);
    return this.findByRefOrThrow(ref);
  }

  private async resolveFleetVehicle(regNbr: string) {
    const fleetVehicle = await this.prisma.fleetVehicle.findFirst({
      where: { regNbr: { equals: regNbr.trim(), mode: 'insensitive' } },
      include: { category: true },
    });
    if (!fleetVehicle) {
      throw new BadRequestException(
        `No Fleet vehicle with registration "${regNbr}"`,
      );
    }
    return fleetVehicle;
  }

  private async hasStep(tripId: string, step: TripStepKind): Promise<boolean> {
    const found = await this.prisma.tripStep.findUnique({
      where: { tripId_step: { tripId, step } },
    });
    return !!found;
  }

  private async stampStep(tripId: string, step: TripStepKind): Promise<void> {
    await this.prisma.tripStep.upsert({
      where: { tripId_step: { tripId, step } },
      create: { tripId, step },
      update: { occurredAt: new Date() },
    });
  }

  private async findByRefOrThrow(ref: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { ref },
      include: TRIP_INCLUDE,
    });
    if (!trip) throw new NotFoundException('Trip not found');
    return trip;
  }
}
