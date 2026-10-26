import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { randomUUID } from 'node:crypto';
import { basename, extname } from 'node:path';
import { requireAdminPassword } from '../common/auth/admin-password';
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
import { CompanyService } from '../company/company.service';
import { PartnerMailerService } from '../common/mailer/partner-mailer.service';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation';
import {
  buildAvailableMailto,
  buildDeclineMailto,
  buildPartnerEmailHtml,
  signPartnerLink,
  verifyPartnerLink,
} from './partner-link.util';
import {
  buildCanceledSubcontractEmail,
  buildSubcontractEmail,
  type TripForSubcontractEmail,
} from './subcontract-email.util';
import {
  SubcontractEmailKind,
  SubcontractEmailQueryDto,
} from './dto/subcontract-email-query.dto';
import { SubcontractEmailEntity } from './dto/subcontract-email.entity';
import { SendSubcontractEmailDto } from './dto/send-subcontract-email.dto';
import { compatibleFleetCategories } from '../common/constants/vehicle-compatibility';
import {
  fleetVehicleEffectivelyActiveFilter,
  todayUtcMidnight,
} from '../common/business/assignability';
import {
  decideAssignment,
  isPriceChange,
  refuseEditPermission,
  type EditRefusal,
  type TripBeforeEdit,
} from '../common/business/trip-assignment';
import {
  refuseIncompatibleFleetVehicle,
  resolveBookingFields,
  shouldHonourReservedVehicle,
} from '../common/business/booking-fields';
import { MESSAGES } from '../common/constants/messages';
import {
  driverDisplayName,
  driverLabel,
  currentStep,
  type DriverStep,
  TRIP_STEP_ORDER,
  isBeforeArrival,
} from '@cockpit/shared';
import {
  buildTripMessageContext,
  driverFingerprint,
  driverRelevantChange,
  pocRelevantChange,
  type TripForMessage,
} from './trip-message.util';
import { toPublicTrip } from './public-trip.mapper';
import { tripWindow } from './trip-window';
import {
  isTripCompleted,
  subcontractCompletionBlocker,
} from './trip-completion';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { AssignTripDto } from './dto/assign-trip.dto';
import { CancelAssignmentDto } from './dto/cancel-assignment.dto';
import { ListTripsQueryDto } from './dto/list-trips-query.dto';
import { CancellationFee, TripStepKind } from '../../generated/prisma/enums';
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
  // Nests the real Partner (if any) this driver's roster belongs to, so
  // resolvePartnerEmail can prefer the company's own contact email over the
  // driver's — see Driver.partnerId's comment in schema.prisma.
  partner: { include: { partner: true } },
  // The Partner company itself, for a booking farmed out with no driver of
  // theirs picked (Trip.directPartnerId) — see the notifyDirectPartner* helpers.
  directPartner: true,
  vehicleType: true,
  fleetVehicle: { include: { category: true } },
  steps: true,
} as const;

const FLEET_VEHICLE_INCLUDE = { category: true } as const;

type FleetVehicleWithCategory = Prisma.FleetVehicleGetPayload<{
  include: typeof FLEET_VEHICLE_INCLUDE;
}>;

// null = the step is recorded but sends nothing to the POC.
const STEP_MESSAGE_KEY: Record<
  DriverStep,
  'arrived' | 'onboard' | 'dropped' | null
> = {
  ACCEPTED: null,
  ENROUTE: null,
  ARRIVED: 'arrived',
  ONBOARD: 'onboard',
  DROPPED: 'dropped',
};

/** The stored booking, in the shape the assignment rules read it. */
function toBeforeEdit(trip: {
  pickupAt: Date;
  driverId: string | null;
  partnerId: string | null;
  directPartnerId: string | null;
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
    directPartnerId: trip.directPartnerId,
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
    private readonly partnerMailer: PartnerMailerService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  list(query: ListTripsQueryDto): Promise<TripEntity[]> {
    return this.prisma.trip.findMany({
      where: tripWindow(query),
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

    if (dto.subContractor && dto.partnerRef && dto.directPartnerRef) {
      throw new BadRequestException(
        'A booking can be sub-contracted to a partner driver (partnerRef) or straight to the partner company (directPartnerRef), not both.',
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

    const directPartner =
      dto.subContractor && dto.directPartnerRef
        ? await this.prisma.partner.findUnique({
            where: { ref: dto.directPartnerRef },
          })
        : null;
    if (dto.subContractor && dto.directPartnerRef && !directPartner) {
      throw new BadRequestException(
        `directPartnerRef "${dto.directPartnerRef}" does not match an existing partner`,
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
        directPartnerId: directPartner?.id ?? null,
        dispatched: locked,
        steps: locked
          ? { create: [{ step: TripStepKind.TRANSMITTED }] }
          : undefined,
      },
    });

    const created = await this.findByRefOrThrow(ref);
    // The POC is told who their driver is as soon as one is assigned.
    if (driverId && created.tracking) {
      await this.messagePoc(created, 'assigned');
    }
    // Nothing is emailed here: the partner is told through the review-then-send
    // dialog the form opens right after the save (subcontractEmail /
    // sendSubcontractEmail), never before the dispatcher has validated it.
    this.realtime.emitTripChanged(ref);
    return created;
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
    // Changing a price is also behind the admin's password, on top of the role.
    if (
      isPriceChange(toBeforeEdit(trip), {
        priceEur: dto.priceEur ?? null,
        partnerRateEur: dto.partnerRateEur ?? null,
      })
    ) {
      await this.requireAdminPassword(user, dto.adminPassword);
    }

    const previousDriverId = trip.driverId;
    const previousPartnerId = trip.partnerId;
    const previousDirectPartnerId = trip.directPartnerId;

    const { data, client, driverId } = await this.resolveTripInputs(dto, {
      previousDriverId,
    });

    if (dto.subContractor && dto.partnerRef && dto.directPartnerRef) {
      throw new BadRequestException(
        'A booking can be sub-contracted to a partner driver (partnerRef) or straight to the partner company (directPartnerRef), not both.',
      );
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
    let directPartnerId: string | null | undefined;
    let directPartner: { id: string; email: string; ref: string } | null = null;
    if (dto.directPartnerRef !== undefined) {
      directPartner = dto.directPartnerRef
        ? await this.prisma.partner.findUnique({
            where: { ref: dto.directPartnerRef },
          })
        : null;
      if (dto.directPartnerRef && !directPartner) {
        throw new BadRequestException(
          `directPartnerRef "${dto.directPartnerRef}" does not match an existing partner`,
        );
      }
      directPartnerId = directPartner?.id ?? null;
    }
    // "Not sub-contracted" and "still has a partner" cannot both hold: the
    // Partner log would list the booking and its Bookings row would show the
    // partner as the driver. Un-ticking Sub-C is how a job is taken back
    // in-house, and the legacy client said so by sending an empty partnerRef
    // (quickUpdateTrip, common.js:2795-2802). Settled here so it holds whatever
    // the payload leaves out. Same rule for the direct-partner-company case.
    const finalPartnerId =
      dto.subContractor === false
        ? null
        : partnerId !== undefined
          ? partnerId
          : previousPartnerId;
    const finalDirectPartnerId =
      dto.subContractor === false
        ? null
        : directPartnerId !== undefined
          ? directPartnerId
          : previousDirectPartnerId;
    // A partner driver being (re)assigned takes over from a bare partner
    // company, and vice versa — the payload only ever names one of the two.
    const finalPartnerIdResolved =
      finalDirectPartnerId && partnerId === undefined
        ? null
        : finalPartnerId;
    const finalDirectPartnerIdResolved =
      finalPartnerIdResolved && directPartnerId === undefined
        ? null
        : finalDirectPartnerId;

    const decision = decideAssignment(
      toBeforeEdit(trip),
      {
        driverId,
        partnerId: finalPartnerIdResolved,
        directPartnerId: finalDirectPartnerIdResolved,
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
        // finalPartnerIdResolved already carries "unchanged" as the previous
        // value, so writing it unconditionally is the same edit — and it is
        // the one the sub-contract invariant above was applied to. Same for
        // finalDirectPartnerIdResolved, its bare-partner-company companion.
        partnerId: finalPartnerIdResolved,
        directPartnerId: finalDirectPartnerIdResolved,
        dispatched: decision.dispatched,
        ...(decision.reassigned && {
          assignmentCancelled: false,
          assignmentCancelledAt: null,
          cancellationFee: null,
        }),
      },
    });

    const full = await this.findByRefOrThrow(newRef);
    // Any change the driver would care about — a new driver/partner, a new
    // vehicle, or anything in the mission details — invalidates what they were
    // sent: the status goes back to the start and the job has to be sent again
    // and accepted again. Once the driver is in position (or beyond) the job is
    // under way, so only a change of driver/partner still restarts it.
    const detailsChanged =
      isBeforeArrival(trip) && driverRelevantChange(trip, full);
    const statusReset = decision.reassigned || detailsChanged;
    if (statusReset) {
      await this.prisma.tripStep.deleteMany({ where: { tripId: trip.id } });
    }
    // Edited after it was sent to the same partner: it reads "Updated - Send ?"
    // (red) until the updated email goes out, then "Sent" until they Confirm or
    // Decline. A new assignment or any reset also wipes a previous "Declined".
    const awaitingUpdateEmail =
      detailsChanged &&
      !decision.reassigned &&
      full.subContractor &&
      (!!full.partnerId || !!full.directPartnerId);
    if (
      statusReset &&
      (trip.partnerDeclinedAt ||
        trip.partnerUpdatePending ||
        awaitingUpdateEmail)
    ) {
      await this.prisma.trip.update({
        where: { id: trip.id },
        data: {
          partnerDeclinedAt: null,
          partnerUpdatePending: awaitingUpdateEmail,
        },
      });
    }
    if (decision.stampTransmitted) {
      await this.prisma.tripStep.create({
        data: { tripId: trip.id, step: TripStepKind.TRANSMITTED },
      });
    }

    let notifyWarning: string | null = null;
    // The POC hears about it too: a newly assigned driver, or a change to what
    // they care about (pickup, drop-off, date/time, vehicle, pax) under the
    // same driver.
    const pocKind =
      driverId && driverId !== previousDriverId
        ? 'assigned'
        : decision.notifyPoc && pocRelevantChange(trip, full)
          ? 'updated'
          : null;
    if (pocKind && full.tracking) {
      const failure = await this.messagePoc(full, pocKind);
      if (failure) {
        notifyWarning = `Changes saved, but the ${pocKind === 'assigned' ? 'assignment' : 'update'} WhatsApp message to the POC failed to send: ${failure}`;
      }
    }

    // Partner notifications — a driver/company actually lost this job, not
    // merely an unrelated field edit. Only losing the job is handled here
    // automatically. Gaining one (a partner driver or a bare partner company)
    // never emails on its own: the form opens the review-then-send screen and
    // nothing leaves until the dispatcher clicks Send.
    const partnerWarnings: string[] = [];
    if (previousPartnerId && previousPartnerId !== finalPartnerIdResolved) {
      const warning = await this.notifyPartnerDriverCancelled(trip.partner, full);
      if (warning) partnerWarnings.push(warning);
    }
    if (
      previousDirectPartnerId &&
      previousDirectPartnerId !== finalDirectPartnerIdResolved
    ) {
      const warning = await this.notifyDirectPartnerCancelled(
        trip.directPartner,
        full,
      );
      if (warning) partnerWarnings.push(warning);
    }
    if (partnerWarnings.length > 0) {
      const joined = partnerWarnings.join(' ');
      notifyWarning = notifyWarning ? `${notifyWarning} ${joined}` : joined;
    }

    this.realtime.emitTripChanged(newRef);
    return {
      ok: true,
      trip: await this.findByRefOrThrow(newRef),
      notifyWarning,
      // Edited, same partner, already sub-contracted: the partner has to be
      // told (and confirm again) — the form opens the review-then-send screen.
      subcontractUpdateRequired: awaitingUpdateEmail,
    };
  }

  // Lightweight counterpart to update() for the Planning Gantt's drag&drop:
  // patches only driverRef and/or fleetRegNbr, deliberately kept independent
  // from update()'s much larger flow (client/price/ref regeneration, etc.)
  // rather than extracted from it.
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
        // The same rule the full PUT runs (shouldHonourReservedVehicle): only
        // a driver actually being (re)assigned, and never over a Reg Nbr named
        // in the same call — one named here is written by the block below
        // either way.
        if (
          driverId &&
          shouldHonourReservedVehicle({
            driverId,
            previousDriverId: trip.driverId,
            fleetRegNbr: dto.fleetRegNbr,
          })
        ) {
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
        const incompatible = refuseIncompatibleFleetVehicle(
          trip.vehicleType.name,
          fleetVehicle,
        );
        if (incompatible) throw toException(incompatible);
      }
      data.fleetVehicle = fleetVehicle
        ? { connect: { id: fleetVehicle.id } }
        : { disconnect: true };
    }

    if (Object.keys(data).length === 0) {
      return {
        ok: true,
        trip,
        notifyWarning: null,
        subcontractUpdateRequired: false,
      };
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
        // This route never touches the partner/direct-partner assignment —
        // only driverRef/fleetRegNbr — so both are handed back unchanged.
        directPartnerId: trip.directPartnerId,
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
    // A new assignee also clears a cancelled assignment; the status reset for
    // any driver-relevant change (vehicle included) happens just below.
    if (decision.reassigned) {
      data.assignmentCancelled = false;
      data.assignmentCancelledAt = null;
      data.cancellationFee = null;
    }

    await this.prisma.trip.update({ where: { id: trip.id }, data });
    const updated = await this.findByRefOrThrow(ref);
    // Same reset as update(): a new driver or vehicle means the job has to be
    // sent again and accepted again.
    const statusReset =
      decision.reassigned ||
      (isBeforeArrival(trip) && driverRelevantChange(trip, updated));
    if (statusReset) {
      await this.prisma.tripStep.deleteMany({ where: { tripId: trip.id } });
      if (trip.partnerDeclinedAt || trip.partnerUpdatePending) {
        await this.prisma.trip.update({
          where: { id: trip.id },
          data: { partnerDeclinedAt: null, partnerUpdatePending: false },
        });
      }
    }
    if (decision.stampTransmitted) {
      await this.prisma.tripStep.create({
        data: { tripId: trip.id, step: TripStepKind.TRANSMITTED },
      });
    }

    // Non-blocking, exactly as in update(): the reassignment is saved either
    // way, the caller just learns the message didn't go out.
    let notifyWarning: string | null = null;
    const pocKind =
      driverId && driverId !== trip.driverId
        ? 'assigned'
        : decision.notifyPoc && pocRelevantChange(trip, updated)
          ? 'updated'
          : null;
    if (pocKind && updated.tracking) {
      const failure = await this.messagePoc(updated, pocKind);
      if (failure) {
        notifyWarning = `Assignment saved, but the ${pocKind === 'assigned' ? 'assignment' : 'update'} WhatsApp message to the POC failed to send: ${failure}`;
      }
    }

    this.realtime.emitTripChanged(ref);
    return {
      ok: true,
      trip: await this.findByRefOrThrow(ref),
      notifyWarning,
      subcontractUpdateRequired: false,
    };
  }

  async cancelAssignment(
    ref: string,
    dto: CancelAssignmentDto,
  ): Promise<CancelAssignmentResponseEntity> {
    const trip = await this.findByRefOrThrow(ref);
    if (isTripCompleted(trip, new Date())) {
      throw new BadRequestException(
        'A completed trip cannot be cancelled: it stays in the invoicing.',
      );
    }

    // Automatic, unlike a fresh partner-driver dispatch — there's no "Send"
    // click to gate this behind, and the whole point of cancelling is that
    // whoever had the job stops expecting it. A partner's own driver gets
    // both channels (they have a WhatsApp number); a bare partner company
    // gets the email only.
    const notifyWarning =
      (await this.notifyPartnerDriverCancelled(trip.partner, trip)) ??
      (await this.notifyDirectPartnerCancelled(trip.directPartner, trip));

    if (!dto.cancellationFee || dto.cancellationFee === CancellationFee.FREE) {
      await this.prisma.$transaction([
        this.prisma.tripStep.deleteMany({ where: { tripId: trip.id } }),
        this.prisma.trip.delete({ where: { id: trip.id } }),
      ]);
      await this.tripRef.release(trip.ref);
      this.realtime.emitTripChanged(trip.ref);
      return { ok: true, deleted: true, notifyWarning };
    }

    await this.prisma.$transaction([
      this.prisma.tripStep.deleteMany({ where: { tripId: trip.id } }),
      this.prisma.trip.update({
        where: { id: trip.id },
        data: {
          driverId: null,
          partnerDeclinedAt: null,
          partnerUpdatePending: false,
          assignmentCancelled: true,
          assignmentCancelledAt: new Date(),
          cancellationFee: dto.cancellationFee,
        },
      }),
    ]);
    this.realtime.emitTripChanged(ref);
    return { ok: true, trip: await this.findByRefOrThrow(ref), notifyWarning };
  }

  private requireAdminPassword(
    user: AuthenticatedUser,
    password: string | undefined,
  ): Promise<void> {
    return requireAdminPassword(this.prisma, user.id, password);
  }

  /**
   * Closes a sub-contracted booking by hand (Sent/Confirmed → Done) so it can
   * be invoiced. The partner has no driver link to mark it Done, so an admin
   * does it, re-entering their own password as the final check.
   */
  async completeSubcontract(
    ref: string,
    password: string,
    user: AuthenticatedUser,
  ): Promise<TripActionResponseEntity> {
    await this.requireAdminPassword(user, password);

    const trip = await this.findByRefOrThrow(ref);
    const blocker = subcontractCompletionBlocker(trip);
    if (blocker) throw new BadRequestException(blocker);

    // Every step the partner never reported is filled in, so the booking
    // reads Done and its history stays a complete pipeline.
    const present = new Set(trip.steps.map((s) => s.step));
    await this.prisma.tripStep.createMany({
      data: TRIP_STEP_ORDER.filter((step) => !present.has(step)).map(
        (step) => ({ tripId: trip.id, step }),
      ),
    });
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

    const messageKey = STEP_MESSAGE_KEY[nextStep];
    if (!trip.tracking || !messageKey) {
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

    const body = MESSAGES[messageKey](buildTripMessageContext(trip));
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

    const messageKey = STEP_MESSAGE_KEY[step];
    if (!trip.tracking || !messageKey) {
      await this.stampStep(trip.id, TripStepKind[step]);
      this.realtime.emitTripChanged(ref);
      return {
        ok: true,
        trip: toPublicTrip(await this.findByRefOrThrow(ref), true),
        skipped: true,
      };
    }

    const body = MESSAGES[messageKey](buildTripMessageContext(trip));
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

  /** One WhatsApp to the booking's POC; returns the failure reason, null when sent or when there is nobody to tell. */
  private async messagePoc(
    trip: TripForMessage & { pocPhone: string | null },
    kind: 'assigned' | 'updated',
  ): Promise<string | null> {
    if (!trip.pocPhone) return null;
    try {
      await this.notifications.send(
        trip.pocPhone,
        MESSAGES[kind](buildTripMessageContext(trip)),
      );
      return null;
    } catch (err) {
      return (err as Error).message;
    }
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

  /**
   * A Partner company's booking (no driver named) was taken back or
   * reassigned elsewhere — automatic email, same "real send" as the
   * assignment notice above; there's no driver to WhatsApp here either.
   */
  private async notifyDirectPartnerCancelled(
    partner: { email: string } | null,
    trip: TripForSubcontractEmail,
  ): Promise<string | null> {
    if (!partner?.email) return null;
    const company = await this.company.get();
    const draft = buildCanceledSubcontractEmail(
      trip,
      partner.email,
      company.name ?? null,
    );
    try {
      await this.partnerMailer.send(partner.email, draft.subject, draft.body);
      return null;
    } catch (err) {
      return `the cancellation email to the partner failed to send: ${(err as Error).message}`;
    }
  }

  /**
   * A partner's own driver was taken off a booking (cancelled, or
   * reassigned elsewhere) — unlike a bare partner company, this one has a
   * real WhatsApp number, so both channels fire automatically: the driver is
   * told directly, and their company gets the same cancellation email
   * sendSubcontractEmail's manual "Send" button would have sent.
   */
  private async notifyPartnerDriverCancelled(
    driver:
      | ({
          phone: string | null;
          email: string | null;
          partner: { email: string } | null;
        } & Parameters<typeof driverDisplayName>[0])
      | null,
    trip: TripForSubcontractEmail & TripForMessage,
  ): Promise<string | null> {
    if (!driver) return null;
    const warnings: string[] = [];
    if (driver.phone) {
      try {
        await this.notifications.send(
          driver.phone,
          MESSAGES.driverCancellation(buildTripMessageContext(trip), {
            name: driverDisplayName(driver),
          }),
        );
      } catch (err) {
        warnings.push(
          `the cancellation WhatsApp to the driver failed to send: ${(err as Error).message}`,
        );
      }
    }
    const to = driver.partner?.email ?? driver.email;
    if (to) {
      const company = await this.company.get();
      const draft = buildCanceledSubcontractEmail(trip, to, company.name ?? null);
      try {
        await this.partnerMailer.send(to, draft.subject, draft.body);
      } catch (err) {
        warnings.push(
          `the cancellation email to the partner failed to send: ${(err as Error).message}`,
        );
      }
    }
    return warnings.length
      ? `Assignment change saved, but ${warnings.join(' and ')}.`
      : null;
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
   * The lookups the booking rules need, then the rules themselves.
   *
   * The decisions live in resolveBookingFields() (common/business), where they
   * can be asserted without a database; this is the adapter that reads what
   * they need and turns a refusal into the exception the route owes. Both
   * create() and update() go through it — they accept the same field set
   * (UpdateTripDto is CreateTripDto minus pocEmail/ref), so the ~26 columns
   * they write identically can't drift apart.
   *
   * Callers keep what genuinely differs between them: ref allocation, pocEmail,
   * partner/sub-contractor handling, and the dispatch/reassignment bookkeeping.
   *
   * The independent lookups are batched — this is on the hot dispatch-desk path
   * and used to cost 5-6 sequential round trips. A payload the rules will
   * refuse now pays for them first, which is what asking the rules once, with
   * everything already resolved, costs.
   */
  private async resolveTripInputs(
    dto: CreateTripDto | UpdateTripDto,
    { previousDriverId }: { previousDriverId?: string | null } = {},
  ) {
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

    // The one lookup that is conditional on a rule rather than on the dto: the
    // reservation is only honoured for a driver actually being (re)assigned
    // (see shouldHonourReservedVehicle).
    const reservedVehicle =
      driver &&
      shouldHonourReservedVehicle({
        driverId: driver.id,
        previousDriverId,
        fleetRegNbr: dto.fleetRegNbr,
      })
        ? await this.findReservedVehicle(driver.id, dto.vehicleType)
        : null;

    const resolved = resolveBookingFields(dto, {
      client,
      driver,
      vehicleType,
      fleetVehicle,
      countryInfo,
      reservedVehicle,
    });
    if (resolved.refusal) throw toException(resolved.refusal);
    return resolved;
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
    return buildSubcontractEmail(
      trip,
      to,
      query.kind === SubcontractEmailKind.UPDATED ? 'updated' : 'assigned',
    );
  }

  /**
   * Actually sends a partner notification, via SMTP from
   * PARTNER_MAILER_FROM (contact@gt-ops.club) — the real send behind the
   * "Send" button on the preview `subcontractEmail` above builds. Re-resolves
   * `to` itself rather than trusting the client, exactly like `subcontractEmail`
   * does; only `subject`/`body` come from the caller, since those are what the
   * dispatcher actually reviewed (and may have edited) in the preview.
   */
  async sendSubcontractEmail(
    ref: string,
    dto: SendSubcontractEmailDto,
  ): Promise<{ ok: true; to: string }> {
    const trip = await this.findByRefOrThrow(ref);
    const to = await this.resolvePartnerEmail(trip, dto.partnerRef);
    if (!to) {
      throw new BadRequestException(
        'No email address on file for this partner — nothing was sent.',
      );
    }
    // The mission recap carries two buttons — "Confirm booking" (one click
    // moves the booking to Confirmed) and "Decline" (marks it Declined and
    // opens a pre-filled reply in the partner's own mail client). Only on the
    // assignment / updated emails, and only when a link secret is configured.
    // Both links are signed with the booking's current details, so they die
    // with the next edit — the update email carries fresh ones.
    const secret = this.config.get('PARTNER_LINK_SECRET', { infer: true });
    const partnerKey = this.partnerKeyFor(trip, dto.partnerRef);
    let html: string | undefined;
    let text = dto.body;
    if (
      secret &&
      partnerKey &&
      dto.kind !== SubcontractEmailKind.CANCELLED &&
      !trip.assignmentCancelled
    ) {
      const base = this.config
        .get('PUBLIC_API_URL', { infer: true })
        .replace(/\/+$/, '');
      const token = signPartnerLink(
        secret,
        trip.ref,
        partnerKey,
        driverFingerprint(trip),
      );
      const link = (action: 'confirm' | 'decline') =>
        `${base}/api/partner-links/${encodeURIComponent(trip.ref)}/${action}?t=${token}`;
      html = buildPartnerEmailHtml(dto.body, {
        confirmUrl: link('confirm'),
        declineUrl: link('decline'),
      });
      text = `${dto.body}\n\nConfirm this booking: ${link('confirm')}\nDecline this booking: ${link('decline')}`;
    }
    await this.partnerMailer.send(to, dto.subject, text, html);
    if (dto.kind === SubcontractEmailKind.UPDATED) {
      // The updated recap is out: "Updated - Send ?" becomes "Sent", waiting
      // for the partner's Confirm or Decline.
      await this.prisma.trip.update({
        where: { id: trip.id },
        data: { partnerUpdatePending: false },
      });
      await this.stampStep(trip.id, TripStepKind.TRANSMITTED);
      this.realtime.emitTripChanged(trip.ref);
    }
    return { ok: true, to };
  }

  /** Who an assignment email is for, as the signed link names them: the partner driver, else the partner company. */
  private partnerKeyFor(
    trip: {
      partner: { ref: string } | null;
      directPartner: { ref: string } | null;
      partnerDeclinedAt?: Date | null;
      partnerDeclinedRef?: string | null;
    },
    partnerRefOverride?: string,
  ): string | null {
    return (
      partnerRefOverride ??
      trip.partner?.ref ??
      trip.directPartner?.ref ??
      // declined: the partner was taken off, the old links still name them
      (trip.partnerDeclinedAt ? (trip.partnerDeclinedRef ?? null) : null)
    );
  }

  /** The partner company's name for the Decline draft's signature. */
  private async partnerDisplayName(
    trip: {
      partner: {
        ref: string;
        firstName: string | null;
        lastName: string | null;
        company: string | null;
        partner: { companyName: string | null; contactName: string } | null;
      } | null;
      directPartner: { companyName: string | null; contactName: string } | null;
      partnerDeclinedAt?: Date | null;
      partnerDeclinedRef?: string | null;
    },
    partnerRefOverride?: string,
  ): Promise<string> {
    if (
      !partnerRefOverride &&
      !trip.partner &&
      !trip.directPartner &&
      trip.partnerDeclinedAt &&
      trip.partnerDeclinedRef
    ) {
      const ref = trip.partnerDeclinedRef;
      const asCompany = await this.prisma.partner.findUnique({ where: { ref } });
      if (asCompany) return asCompany.companyName || asCompany.contactName;
      partnerRefOverride = ref;
    }
    const driver = partnerRefOverride
      ? await this.prisma.driver.findUnique({
          where: { ref: partnerRefOverride },
          include: { partner: true },
        })
      : trip.partner;
    const company = driver?.partner ?? trip.directPartner;
    return (
      company?.companyName ||
      company?.contactName ||
      (driver ? driverLabel(driver) : 'Partner')
    );
  }

  /**
   * What a partner sees when they open the "Confirm booking" / "Decline" link:
   * the booking and a button. Opening a link changes nothing (mail scanners
   * follow every link) — only the button's POST does.
   */
  async partnerLinkPreview(
    ref: string,
    token: string,
  ): Promise<{
    state: 'ready' | 'already' | 'declined' | 'invalid';
    trip?: { ref: string; pickup: string };
  }> {
    const trip = await this.prisma.trip.findUnique({
      where: { ref },
      include: TRIP_INCLUDE,
    });
    if (!trip || !this.partnerLinkValid(trip, token))
      return { state: 'invalid' };
    const confirmed =
      !trip.partnerDeclinedAt &&
      trip.steps.some((s) => s.step === TripStepKind.ACCEPTED);
    return {
      state: trip.partnerDeclinedAt
        ? 'declined'
        : confirmed
          ? 'already'
          : 'ready',
      trip: {
        ref: trip.ref,
        pickup: `${trip.pickupLocation} — ${DateTime.fromJSDate(trip.pickupAt)
          .setZone(trip.timezone ?? 'utc')
          .toFormat('dd/MM/yyyy HH:mm')}`,
      },
    };
  }

  /**
   * The booking becomes "Confirmed" (the ACCEPTED step) — what the partner's
   * click means. A decline is final, though: a partner who declined and then
   * clicks Confirm changes nothing in Cockpit, they get a pre-filled email to
   * tell the dispatcher they can take the job after all, and the dispatcher
   * decides whether to assign it to them.
   */
  async confirmByPartnerLink(
    ref: string,
    token: string,
  ): Promise<
    { outcome: 'confirmed' | 'already' | 'invalid' } | { outcome: 'declined'; mailto: string }
  > {
    const trip = await this.prisma.trip.findUnique({
      where: { ref },
      include: TRIP_INCLUDE,
    });
    if (!trip || !this.partnerLinkValid(trip, token))
      return { outcome: 'invalid' };
    if (trip.partnerDeclinedAt) {
      const company = await this.company.get();
      return {
        outcome: 'declined',
        mailto: buildAvailableMailto({
          to: this.config.get('PARTNER_MAILER_FROM', { infer: true }),
          tripRef: trip.ref,
          companyName: company.name ?? null,
          partnerName: await this.partnerDisplayName(trip),
        }),
      };
    }
    const reached = currentStep(trip.steps);
    if (
      reached &&
      TRIP_STEP_ORDER.indexOf(reached) >= TRIP_STEP_ORDER.indexOf('ACCEPTED')
    ) {
      return { outcome: 'already' };
    }
    await this.stampStep(trip.id, TripStepKind.ACCEPTED);
    this.realtime.emitTripChanged(trip.ref);
    return { outcome: 'confirmed' };
  }

  /**
   * The partner declined: the booking shows as Declined (red, to be
   * reassigned) and the page they land on opens their mail client on the
   * pre-filled reply to the dispatch mailbox.
   */
  async declineByPartnerLink(
    ref: string,
    token: string,
  ): Promise<{ mailto: string } | null> {
    const trip = await this.prisma.trip.findUnique({
      where: { ref },
      include: TRIP_INCLUDE,
    });
    if (!trip || !this.partnerLinkValid(trip, token)) return null;
    if (!trip.partnerDeclinedAt) {
      await this.prisma.trip.update({
        where: { id: trip.id },
        // The declining partner comes off the booking (it goes back to "to
        // assign"), but is remembered so their links still resolve.
        data: {
          partnerDeclinedAt: new Date(),
          partnerDeclinedRef: trip.partner?.ref ?? trip.directPartner?.ref ?? null,
          partnerDeclinedRegNbr: trip.fleetVehicle?.regNbr ?? null,
          partnerId: null,
          directPartnerId: null,
          fleetVehicleId: null,
        },
      });
      this.realtime.emitTripChanged(trip.ref);
    }
    const company = await this.company.get();
    return {
      mailto: buildDeclineMailto({
        to: this.config.get('PARTNER_MAILER_FROM', { infer: true }),
        tripRef: trip.ref,
        companyName: company.name ?? null,
        partnerName: await this.partnerDisplayName(trip),
      }),
    };
  }

  private partnerLinkValid(
    trip: Parameters<typeof driverFingerprint>[0] & {
      ref: string;
      assignmentCancelled: boolean;
      partner: { ref: string } | null;
      directPartner: { ref: string } | null;
      partnerDeclinedAt?: Date | null;
      partnerDeclinedRef?: string | null;
      partnerDeclinedRegNbr?: string | null;
    },
    token: string,
  ): boolean {
    const secret = this.config.get('PARTNER_LINK_SECRET', { infer: true });
    const key = this.partnerKeyFor(trip);
    if (!secret || !key || trip.assignmentCancelled) return false;
    // After a decline the vehicle is gone from the booking: check the link
    // against the vehicle it was sent with.
    const sentTrip =
      trip.partnerDeclinedAt && !trip.partner && !trip.directPartner
        ? {
            ...trip,
            fleetVehicle: trip.partnerDeclinedRegNbr
              ? { regNbr: trip.partnerDeclinedRegNbr }
              : null,
          }
        : trip;
    return verifyPartnerLink(
      secret,
      trip.ref,
      key,
      driverFingerprint(sentTrip as typeof trip),
      token,
    );
  }

  /**
   * The partner's own email.
   *
   * Once the assigned partner driver has been attached to a real Partner
   * record (Driver.partnerId — see the Partner-companies feature), that
   * company's own contact email is what actually gets notified, since that's
   * who the "Send" step in the new preview-and-send flow addresses — the
   * driver's personal email is only a fallback for one not yet migrated.
   *
   * A booking can also be farmed out straight to a Partner *company* with no
   * driver of theirs picked (Trip.directPartnerId — see TRIP_INCLUDE's note
   * on directPartner). That case has no Driver.partner relation to walk at
   * all, so it falls back to the trip's own directPartner once the
   * driver-based lookup above comes up empty. Only applies when no override
   * was requested — an override always names a specific driver, so it never
   * makes sense to fall back to the trip's unrelated direct partner.
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
    trip: {
      partner: { email: string | null; partner: { email: string } | null } | null;
      directPartner: { email: string } | null;
    },
    partnerRefOverride?: string,
  ): Promise<string | null> {
    const partner = partnerRefOverride
      ? await this.prisma.driver.findUnique({
          where: { ref: partnerRefOverride },
          include: { partner: true },
        })
      : trip.partner;
    const driverBased = partner?.partner?.email ?? partner?.email ?? null;
    if (driverBased) return driverBased;
    return partnerRefOverride ? null : (trip.directPartner?.email ?? null);
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
