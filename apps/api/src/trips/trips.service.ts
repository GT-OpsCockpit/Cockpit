import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { CancelAssignmentDto } from './dto/cancel-assignment.dto';
import { DRIVER_STEP_VALUES } from './dto/notify-step.dto';
import {
  CancellationFee,
  Service,
  TripStepKind,
} from '../../generated/prisma/enums';

const TRIP_INCLUDE = {
  client: true,
  driver: true,
  partner: true,
  vehicleType: true,
  fleetVehicle: { include: { category: true } },
  steps: true,
} as const;

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

  list() {
    return this.prisma.trip.findMany({
      include: TRIP_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPublic(ref: string, viewerIsDriver: boolean) {
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
      await this.prisma.tripStep.createMany({
        data: [
          ...(missingTransmitted
            ? [{ tripId: trip.id, step: TripStepKind.TRANSMITTED }]
            : []),
          { tripId: trip.id, step: TripStepKind.RECEIVED },
        ],
      });
      this.realtime.emitTripChanged(ref);
      return this.findByRefOrThrow(ref);
    }
    return trip;
  }

  // TODO: the vehicleType/client/driver/partner/countryInfo lookups below
  // (and the equivalent block in update()) are independent of each other
  // and currently awaited one at a time — 5-6 sequential DB round trips per
  // call. Batch the independent ones with Promise.all to cut latency on
  // these hot dispatch-desk paths.
  async create(dto: CreateTripDto) {
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

  async update(ref: string, dto: UpdateTripDto) {
    const trip = await this.findByRefOrThrow(ref);

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

  async cancelAssignment(ref: string, dto: CancelAssignmentDto) {
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

  async advanceStep(ref: string) {
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

  async notify(ref: string, step: (typeof DRIVER_STEP_VALUES)[number]) {
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
        trip: await this.findByRefOrThrow(ref),
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
    return { ok: true, trip: await this.findByRefOrThrow(ref) };
  }

  async dispatchDriver(ref: string) {
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

  async setNameboard(ref: string, filename: string) {
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
