import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { basename, extname } from 'node:path';
import { DateTime } from 'luxon';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../common/guards/session-auth.guard';
import { TripRefService } from './trip-ref.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import {
  NAMEBOARD_KEY_PREFIX,
  NAMEBOARD_URL_PREFIX,
  type UploadedNameboard,
} from './nameboard-upload.config';
import { StorageService } from '../common/storage/storage.service';
import { normalizePhone } from '../common/utils/normalize-phone';
import { CompanyService } from '../company/company.service';
import {
  buildCanceledSubcontractEmail,
  buildSubcontractEmail,
} from './subcontract-email.util';
import {
  SubcontractEmailKind,
  SubcontractEmailQueryDto,
} from './dto/subcontract-email-query.dto';
import { SubcontractEmailEntity } from './dto/subcontract-email.entity';
import { compatibleFleetCategories } from '../common/constants/vehicle-compatibility';
import {
  fleetVehicleEffectivelyActiveFilter,
  todayUtcMidnight,
} from '../common/business/assignability';
import {
  decideAssignment,
  refuseEditPermission,
  type EditRefusal,
  type TripBeforeEdit,
} from '../common/business/trip-assignment';
import { MESSAGES } from '../common/constants/messages';
import {
  driverDisplayName,
  type DriverStep,
  TRIP_STEP_ORDER,
} from '@cockpit/shared';
import { buildTripMessageContext } from './trip-message.util';
import { toPublicTrip } from './public-trip.mapper';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { AssignTripDto } from './dto/assign-trip.dto';
import { CancelAssignmentDto } from './dto/cancel-assignment.dto';
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

const FLEET_VEHICLE_INCLUDE = { category: true } as const;

type FleetVehicleWithCategory = Prisma.FleetVehicleGetPayload<{
  include: typeof FLEET_VEHICLE_INCLUDE;
}>;

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

/**
 * The Bookings board's search box, token by token: every word typed has to turn
 * up somewhere, in any of the searched fields.
 *
 * Same rule as searchTokensFilter (Clients/Drivers/Vehicles), spelled out here
 * because the fields it has to reach are on four different records. The account
 * and driver `name`s a dispatcher types are derived, never stored, so what gets
 * searched is what they are derived from — including the partner's, since the
 * board's Driver column falls back to it.
 */
function tripSearchFilter(
  search: string | undefined,
): Prisma.TripWhereInput[] | undefined {
  const tokens = (search ?? '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return undefined;

  const has = (token: string) =>
    ({ contains: token, mode: 'insensitive' }) as const;
  const assignee = (token: string) => ({
    OR: [
      { firstName: has(token) },
      { lastName: has(token) },
      { company: has(token) },
      { ref: has(token) },
    ],
  });

  return tokens.map((token) => ({
    OR: [
      { ref: has(token) },
      { passengerName: has(token) },
      {
        client: {
          OR: [
            { company: has(token) },
            { contactFirstName: has(token) },
            { contactLastName: has(token) },
            { ref: has(token) },
          ],
        },
      },
      { driver: assignee(token) },
      { partner: assignee(token) },
    ],
  }));
}

const STEP_MESSAGE_KEY: Record<
  DriverStep,
  'accepted' | 'enroute' | 'arrived' | 'onboard' | 'dropped'
> = {
  ACCEPTED: 'accepted',
  ENROUTE: 'enroute',
  ARRIVED: 'arrived',
  ONBOARD: 'onboard',
  DROPPED: 'dropped',
};

/** The stored booking, in the shape the assignment rules read it. */
function toBeforeEdit(trip: {
  pickupAt: Date;
  driverId: string | null;
  partnerId: string | null;
  priceEur: Prisma.Decimal | null;
  partnerRateEur: Prisma.Decimal | null;
  pocName: string | null;
  pocPhone: string | null;
  steps: { step: TripStepKind }[];
  assignmentCancelled: boolean;
}): TripBeforeEdit {
  return {
    pickupAt: trip.pickupAt,
    driverId: trip.driverId,
    partnerId: trip.partnerId,
    priceEur: trip.priceEur ? trip.priceEur.toNumber() : null,
    partnerRateEur: trip.partnerRateEur ? trip.partnerRateEur.toNumber() : null,
    pocName: trip.pocName,
    pocPhone: trip.pocPhone,
    steps: trip.steps,
    assignmentCancelled: trip.assignmentCancelled,
  };
}

/** The HTTP status a refusal owes — the rules themselves stay transport-agnostic. */
function toException(refusal: EditRefusal) {
  return refusal.kind === 'forbidden'
    ? new ForbiddenException(refusal.message)
    : new BadRequestException(refusal.message);
}

@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tripRef: TripRefService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
    private readonly company: CompanyService,
    private readonly storage: StorageService,
  ) {}

  list(query: ListTripsQueryDto): Promise<TripEntity[]> {
    const period = query.period ?? 'upcoming';
    const category = query.category ?? 'daily';
    const nowParis = DateTime.now().setZone(PARIS_ZONE);

    // Live dispatch board only (`board=true`, Bookings): a trip whose pickup
    // was before *today* (Paris) drops out of view once it has a driver —
    // an already-handled job is clutter, an unassigned one still needs
    // attention. The legacy applied this client-side on the Bookings page
    // and nowhere else, so it must stay opt-in: Invoicing bills completed
    // months, and Events/Partner log/Planning all need their past history.
    const where: Prisma.TripWhereInput = query.board
      ? {
          OR: [
            { pickupAt: { gte: nowParis.startOf('day').toJSDate() } },
            { driverId: null },
          ],
        }
      : {};
    const client: Prisma.ClientWhereInput = {};
    if (category === 'daily') client.clientType = { not: ClientType.EVENT };
    else if (category === 'event') client.clientType = ClientType.EVENT;
    if (query.clientRef) client.ref = query.clientRef;
    // Ref/PO is a field of the account, not of the booking — so it joins the
    // same `client` filter rather than becoming a second one (which would
    // overwrite the clientType/ref keys built just above).
    if (query.refPo?.trim()) {
      client.refPoOther = {
        contains: query.refPo.trim(),
        mode: 'insensitive',
      };
    }
    if (Object.keys(client).length > 0) where.client = client;

    // The board's own filter bar, resolved here rather than over an unbounded
    // fetch in the browser (was applyBookingFilters, trip-status.ts).
    const search = tripSearchFilter(query.search);
    if (search) where.AND = search;
    if (query.driverRef) where.driver = { ref: query.driverRef };
    if (query.partnerRef) where.partner = { ref: query.partnerRef };
    if (query.vehicleType) where.vehicleType = { name: query.vehicleType };
    if (query.fleetRegNbr) where.fleetVehicle = { regNbr: query.fleetRegNbr };
    if (query.service) where.service = query.service;
    if (query.passenger?.trim()) {
      where.passengerName = {
        contains: query.passenger.trim(),
        mode: 'insensitive',
      };
    }
    // An explicit window replaces the named period entirely — see
    // ListTripsQueryDto.from.
    const window =
      query.from || query.to
        ? {
            ...(query.from && { gte: new Date(query.from) }),
            ...(query.to && { lt: new Date(query.to) }),
          }
        : periodDateRange(period, nowParis);
    if (window) where.pickupAt = window;
    if (query.hasPartner) where.partnerId = { not: null };
    if (query.unbilled) where.invoiced = false;

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

  async create(dto: CreateTripDto): Promise<TripEntity> {
    const { data, client, driverId } = await this.resolveTripInputs(dto);

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

    const locked = !!dto.subContractor && !partner;

    await this.prisma.trip.create({
      data: {
        ...data,
        ref,
        // Only create() takes a pocEmail — the legacy's edit popup has no such
        // field, so UpdateTripDto omits it (see update-trip.dto.ts).
        pocEmail: dto.pocEmail || client.pocEmail || null,
        driverId,
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
    const now = new Date();
    const options = { now, pastEditAction: 'Editing' as const };

    // Asked before anything is resolved, so a dispatcher editing a past
    // booking is told they need the Admin role rather than which unrelated
    // field of their payload is also wrong. decideAssignment() asks again on
    // the full intent below.
    const denied = refuseEditPermission(
      toBeforeEdit(trip),
      {
        priceEur: dto.priceEur ?? null,
        partnerRateEur: dto.partnerRateEur ?? null,
      },
      user,
      options,
    );
    if (denied) throw toException(denied);

    const previousDriverId = trip.driverId;
    const previousPartnerId = trip.partnerId;

    const { data, client, driverId } = await this.resolveTripInputs(dto, {
      previousDriverId,
    });

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

    const decision = decideAssignment(
      toBeforeEdit(trip),
      {
        driverId,
        partnerId: finalPartnerId,
        subContractor:
          dto.subContractor !== undefined
            ? dto.subContractor
            : trip.subContractor,
        tracking: data.tracking,
        priceEur: dto.priceEur ?? null,
        partnerRateEur: dto.partnerRateEur ?? null,
        // Compared against what would actually be stored, since an omitted POC
        // falls back to the client account's (see resolveTripInputs).
        pocName: data.pocName,
        pocPhone: data.pocPhone,
        notifyPoc: !!dto.notifyDriver,
      },
      user,
      options,
    );
    if (decision.refusal) throw toException(decision.refusal);

    let newRef = trip.ref;
    if (client.id !== trip.clientId) {
      newRef = await this.tripRef.generate(client.ref);
      await this.tripRef.release(trip.ref);
    }

    await this.prisma.trip.update({
      where: { id: trip.id },
      data: {
        ...data,
        ref: newRef,
        driverId,
        ...(dto.subContractor !== undefined && {
          subContractor: dto.subContractor,
        }),
        ...(partnerId !== undefined && { partnerId }),
        dispatched: decision.dispatched,
        ...(decision.reassigned && {
          assignmentCancelled: false,
          assignmentCancelledAt: null,
          cancellationFee: null,
        }),
      },
    });

    if (decision.reassigned) {
      await this.prisma.tripStep.deleteMany({ where: { tripId: trip.id } });
    }
    if (decision.stampTransmitted) {
      await this.prisma.tripStep.create({
        data: { tripId: trip.id, step: TripStepKind.TRANSMITTED },
      });
    }

    let notifyWarning: string | null = null;
    if (decision.notifyPoc) {
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
  ): Promise<UpdateTripResponseEntity> {
    const trip = await this.findByRefOrThrow(ref);
    const hadDriver = !!trip.driverId;
    const before = toBeforeEdit(trip);
    const options = { now: new Date(), pastEditAction: 'Reassigning' as const };

    const denied = refuseEditPermission(
      before,
      { priceEur: before.priceEur, partnerRateEur: before.partnerRateEur },
      user,
      options,
    );
    if (denied) throw toException(denied);

    const data: Prisma.TripUpdateInput = {};
    let driverId = trip.driverId;

    if (dto.driverRef !== undefined) {
      const driver = dto.driverRef
        ? await this.prisma.driver.findUnique({ where: { ref: dto.driverRef } })
        : null;
      if (dto.driverRef && !driver) {
        throw new BadRequestException(
          `driverRef "${dto.driverRef}" does not match an existing driver`,
        );
      }
      driverId = driver?.id ?? null;
      if (driverId !== trip.driverId) {
        data.driver = driverId
          ? { connect: { id: driverId } }
          : { disconnect: true };
        // Honour this driver's reserved vehicle, unless the caller is also
        // naming one in the same call (see findReservedVehicle).
        if (driverId && dto.fleetRegNbr === undefined) {
          const reserved = await this.findReservedVehicle(
            driverId,
            trip.vehicleType?.name,
          );
          if (reserved) data.fleetVehicle = { connect: { id: reserved.id } };
        }
      }
    }

    if (dto.fleetRegNbr !== undefined) {
      const fleetVehicle = dto.fleetRegNbr
        ? await this.resolveFleetVehicle(dto.fleetRegNbr)
        : null;
      if (fleetVehicle && trip.vehicleType) {
        this.assertFleetCompatible(trip.vehicleType.name, fleetVehicle);
      }
      data.fleetVehicle = fleetVehicle
        ? { connect: { id: fleetVehicle.id } }
        : { disconnect: true };
    }

    if (Object.keys(data).length === 0) {
      return { ok: true, trip, notifyWarning: null };
    }

    // The same rules the full PUT runs (see update()) — this route just cannot
    // reach the price, the POC or the sub-contract, so it hands those back
    // unchanged and the rules see no change in them.
    //
    // `notifyPoc: hadDriver` is the legacy's own funnelling of every quick edit
    // through the full PUT with `notifyDriver: hadDriver` (quickUpdateTrip,
    // common.js:3310): a booking that already had a driver had already been
    // announced, so the POC is told it changed. One that had none has nothing
    // to correct yet.
    const decision = decideAssignment(
      before,
      {
        driverId,
        partnerId: trip.partnerId,
        subContractor: trip.subContractor,
        tracking: trip.tracking,
        priceEur: before.priceEur,
        partnerRateEur: before.partnerRateEur,
        pocName: trip.pocName,
        pocPhone: trip.pocPhone,
        notifyPoc: hadDriver,
      },
      user,
      options,
    );
    if (decision.refusal) throw toException(decision.refusal);

    data.dispatched = decision.dispatched;
    // Only a change of assignee wipes the progress — a vehicle swap re-arms
    // the Send button without restarting the pipeline.
    if (decision.reassigned) {
      data.assignmentCancelled = false;
      data.assignmentCancelledAt = null;
      data.cancellationFee = null;
    }

    await this.prisma.trip.update({ where: { id: trip.id }, data });
    if (decision.reassigned) {
      await this.prisma.tripStep.deleteMany({ where: { tripId: trip.id } });
    }
    if (decision.stampTransmitted) {
      await this.prisma.tripStep.create({
        data: { tripId: trip.id, step: TripStepKind.TRANSMITTED },
      });
    }

    // Non-blocking, exactly as in update(): the reassignment is saved either
    // way, the caller just learns the message didn't go out.
    let notifyWarning: string | null = null;
    const updated = await this.findByRefOrThrow(ref);
    if (decision.notifyPoc) {
      try {
        await this.notifications.send(
          updated.pocPhone!,
          MESSAGES.updated(buildTripMessageContext(updated)),
        );
      } catch (err) {
        notifyWarning = `Assignment saved, but the update WhatsApp message failed to send: ${(err as Error).message}`;
      }
    }

    this.realtime.emitTripChanged(ref);
    return { ok: true, trip: updated, notifyWarning };
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
    TRIP_STEP_ORDER.forEach((key, i) => {
      if (present.has(key)) currentIndex = i;
    });
    const nextIndex = currentIndex + 1;
    if (nextIndex >= TRIP_STEP_ORDER.length) {
      throw new BadRequestException(
        'This trip is already at its last status (Done).',
      );
    }
    const nextStep = TRIP_STEP_ORDER[nextIndex];

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
    step: DriverStep,
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
      name: driverDisplayName(assignee),
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

  async setNameboard(
    ref: string,
    file: UploadedNameboard,
  ): Promise<TripEntity> {
    const trip = await this.findByRefOrThrow(ref);

    // Replacing a nameboard: drop the object the trip pointed at, otherwise
    // every replacement would leak an orphan in the bucket (the disk-backed
    // version this replaced never cleaned up either). Best-effort by design —
    // StorageService.delete() logs instead of throwing, so a failed cleanup
    // can't fail the upload that matters.
    if (trip.nameboardUrl?.startsWith(`${NAMEBOARD_URL_PREFIX}/`)) {
      const previousKey = `${NAMEBOARD_KEY_PREFIX}/${basename(trip.nameboardUrl)}`;
      await this.storage.delete(previousKey);
    }

    const filename = `${randomUUID()}${extname(file.originalname)}`;
    await this.storage.put(
      `${NAMEBOARD_KEY_PREFIX}/${filename}`,
      file.buffer,
      file.mimetype,
    );

    await this.prisma.trip.update({
      where: { id: trip.id },
      data: { nameboardUrl: `${NAMEBOARD_URL_PREFIX}/${filename}` },
    });
    this.realtime.emitTripChanged(ref);
    return this.findByRefOrThrow(ref);
  }

  /**
   * Validation + FK resolution + the column payload shared by create() and
   * update(). Both accept the same field set (UpdateTripDto is CreateTripDto
   * minus pocEmail/ref), so the rules live here once rather than being mirrored
   * — a new vehicle-compatibility or POC rule is written in one place, and the
   * ~26 columns the two write identically can't drift apart.
   *
   * Callers keep what genuinely differs between them: ref allocation, pocEmail,
   * partner/sub-contractor handling, and the dispatch/reassignment bookkeeping.
   *
   * The independent lookups are batched — this is on the hot dispatch-desk path
   * and used to cost 5-6 sequential round trips. The checks below still run in
   * their original order, so a doubly-invalid dto reports the same error it did
   * when each lookup was awaited in turn.
   */
  private async resolveTripInputs(
    dto: CreateTripDto | UpdateTripDto,
    { previousDriverId }: { previousDriverId?: string | null } = {},
  ) {
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

    const [vehicleType, fleetVehicle, client, driver, countryInfo] =
      await Promise.all([
        dto.vehicleType
          ? this.prisma.vehicleType.findUnique({
              where: { name: dto.vehicleType },
            })
          : null,
        dto.fleetRegNbr?.trim() ? this.findFleetVehicle(dto.fleetRegNbr) : null,
        this.prisma.client.findUnique({ where: { ref: dto.clientRef } }),
        dto.driverRef
          ? this.prisma.driver.findUnique({ where: { ref: dto.driverRef } })
          : null,
        this.prisma.country.findUnique({ where: { code: dto.countryCode } }),
      ]);

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

    let autoInstructionsNote: string | null = null;
    if (dto.fleetRegNbr?.trim()) {
      if (!fleetVehicle) {
        throw new BadRequestException(
          `No Fleet vehicle with registration "${dto.fleetRegNbr}"`,
        );
      }
      if (dto.vehicleType) {
        this.assertFleetCompatible(dto.vehicleType, fleetVehicle);
        if (
          dto.vehicleType === 'Lugg.' &&
          fleetVehicle.category.name === 'Van'
        ) {
          autoInstructionsNote = 'Need to remove seats';
        }
      }
    }

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

    if (dto.driverRef && !driver) {
      throw new BadRequestException(
        `driverRef "${dto.driverRef}" does not match an existing driver`,
      );
    }

    // A partner chauffeur can have one fleet vehicle reserved for them (the
    // padlock on Drivers & Partners). Assigning that chauffeur to a booking
    // without naming a vehicle honours the reservation instead of leaving it
    // informational — the legacy did this client-side in two places
    // (autoAssignLinkedVehicleInBookingBar for the New booking bar,
    // quickUpdateTrip for every later reassignment); doing it here covers
    // create, update and the Planning drag & drop from one place.
    // Only when the driver is actually being (re)assigned, never on an
    // unrelated edit — otherwise deliberately clearing the Reg Nbr on a
    // booking would silently re-add the reserved vehicle on every save.
    const reservedVehicle =
      driver && driver.id !== previousDriverId && !dto.fleetRegNbr?.trim()
        ? await this.findReservedVehicle(driver.id, dto.vehicleType)
        : null;

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
        fleetVehicleId: fleetVehicle?.id ?? reservedVehicle?.id ?? null,
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
  private assertFleetCompatible(
    vehicleTypeName: string,
    fleetVehicle: FleetVehicleWithCategory,
  ): void {
    const allowed = compatibleFleetCategories(vehicleTypeName);
    if (!allowed.includes(fleetVehicle.category.name)) {
      throw new BadRequestException(
        `Vehicle ${fleetVehicle.regNbr} (${fleetVehicle.category.name}) cannot service a ${vehicleTypeName} trip — compatible categories: ${allowed.join(', ')}`,
      );
    }
  }

  /**
   * The fleet vehicle reserved for this driver, if it's assignable right now:
   * available today, within its event window, and of a category compatible
   * with the booking. Never forces an incompatible or out-of-service vehicle
   * — same guard the legacy applied before auto-filling the Reg Nbr field.
   */
  private async findReservedVehicle(
    driverId: string,
    vehicleTypeName: string | undefined,
  ): Promise<FleetVehicleWithCategory | null> {
    const vehicle = await this.prisma.fleetVehicle.findFirst({
      where: {
        driverId,
        ...fleetVehicleEffectivelyActiveFilter(todayUtcMidnight()),
        ...(vehicleTypeName && {
          category: {
            name: { in: compatibleFleetCategories(vehicleTypeName) },
          },
        }),
      },
      include: FLEET_VEHICLE_INCLUDE,
    });
    return vehicle;
  }

  private findFleetVehicle(
    regNbr: string,
  ): Promise<FleetVehicleWithCategory | null> {
    return this.prisma.fleetVehicle.findFirst({
      where: { regNbr: { equals: regNbr.trim(), mode: 'insensitive' } },
      include: FLEET_VEHICLE_INCLUDE,
    });
  }

  private async resolveFleetVehicle(
    regNbr: string,
  ): Promise<FleetVehicleWithCategory> {
    const fleetVehicle = await this.findFleetVehicle(regNbr);
    if (!fleetVehicle) {
      throw new BadRequestException(
        `No Fleet vehicle with registration "${regNbr}"`,
      );
    }
    return fleetVehicle;
  }

  private async stampStep(tripId: string, step: TripStepKind): Promise<void> {
    await this.prisma.tripStep.upsert({
      where: { tripId_step: { tripId, step } },
      create: { tripId, step },
      update: { occurredAt: new Date() },
    });
  }

  /**
   * The mailto: draft for a sub-contracted job — the mission recap when it is
   * farmed out, the cancellation notice when it is taken back
   * (openSubcontractEmailDraft / openCanceledSubcontractEmailDraft,
   * common.js:2636 and :2686). Nothing is sent by the app: the front opens
   * the dispatcher's own mail client with this pre-filled, and they still
   * press Send themselves.
   *
   * Composed here rather than in the browser for the same reason the invoice
   * mailto isn't: the body needs the company sheet, the partner roster and
   * the trip's own timezone, none of which the form holds.
   */
  async subcontractEmail(
    ref: string,
    query: SubcontractEmailQueryDto,
  ): Promise<SubcontractEmailEntity> {
    const trip = await this.findByRefOrThrow(ref);
    const to = await this.resolvePartnerEmail(trip, query.partnerRef);

    if (query.kind === SubcontractEmailKind.CANCELLED) {
      const company = await this.company.get();
      return buildCanceledSubcontractEmail(trip, to, company.name ?? null);
    }
    return buildSubcontractEmail(trip, to);
  }

  /**
   * The partner's own email.
   *
   * The legacy fell back to any other record of the same company when the
   * chosen partner had none (common.js:2636) — because its data allowed an
   * emailless partner. v2's assertValidDriverFields does not: an email is
   * required as soon as Company is set, whether or not the record carries a
   * name. So that fallback would be unreachable and is not ported. Null is
   * still possible, since partnerRef is not required to point at a partner:
   * an internal driver has no email obligation.
   */
  private async resolvePartnerEmail(
    trip: { partner: { email: string | null } | null },
    partnerRefOverride?: string,
  ): Promise<string | null> {
    const partner = partnerRefOverride
      ? await this.prisma.driver.findUnique({
          where: { ref: partnerRefOverride },
        })
      : trip.partner;
    return partner?.email ?? null;
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
