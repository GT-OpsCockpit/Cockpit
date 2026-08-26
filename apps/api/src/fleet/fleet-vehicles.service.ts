import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RefCounterService } from '../common/ref-counter/ref-counter.service';
import { EventLinkService } from '../common/event-link/event-link.service';
import {
  FLEET_MAKES,
  FLEET_MODELS_BY_MAKE,
  FLEET_COLOR_VALUES,
  FLEET_DEFAULT_COLOR,
  CATEGORY_MODELS,
  getFleetYearWindow,
} from '../common/constants/fleet';
import { CreateFleetVehicleDto } from './dto/create-fleet-vehicle.dto';
import { SetFleetUnavailabilityDto } from './dto/set-fleet-unavailability.dto';
import { FleetUnavailKind } from '../../generated/prisma/enums';

interface ValidatedFleetVehicle {
  categoryId: string;
  isLocal: boolean;
  eventClientId: string | null;
}

@Injectable()
export class FleetVehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refCounter: RefCounterService,
    private readonly eventLink: EventLinkService,
  ) {}

  async list() {
    const vehicles = await this.prisma.fleetVehicle.findMany({
      include: { category: true, driver: true, unavailability: true },
    });
    vehicles.sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.ref.localeCompare(b.ref);
    });
    return vehicles;
  }

  async create(dto: CreateFleetVehicleDto) {
    const { categoryId, isLocal, eventClientId } = await this.assertValid(dto);

    const existing = await this.prisma.fleetVehicle.findFirst({
      where: { regNbr: { equals: dto.regNbr.trim(), mode: 'insensitive' } },
    });
    if (existing) {
      throw new ConflictException(
        `A vehicle with registration "${dto.regNbr.trim()}" already exists`,
      );
    }

    const driverId = isLocal ? null : await this.resolveDriverId(dto.driverRef);

    const seq = await this.refCounter.next('fleetVehicle');
    const vehicle = await this.prisma.fleetVehicle.create({
      data: {
        ref: `F${seq}`,
        categoryId,
        regNbr: dto.regNbr.trim(),
        make: dto.make,
        model: dto.model,
        yearOfBuild: dto.yearOfBuild,
        fourWD: dto.fourWD,
        nbPax: dto.nbPax,
        color: dto.color || FLEET_DEFAULT_COLOR,
        acronym: dto.acronym?.trim().slice(0, 6) || null,
        isLocal,
        countryCode: !isLocal ? dto.countryCode || null : null,
        area: !isLocal ? dto.area?.trim() || null : null,
        partnerCompany: !isLocal ? dto.partnerCompany?.trim() || null : null,
        driverId,
        eventsOnly: !!dto.eventsOnly,
        eventCountry: dto.eventsOnly ? dto.eventCountry || null : null,
        eventArea: dto.eventsOnly ? dto.eventArea?.trim() || null : null,
        eventClientId,
      },
      include: { category: true, driver: true, unavailability: true },
    });
    return vehicle;
  }

  async update(ref: string, dto: CreateFleetVehicleDto) {
    await this.findByRefOrThrow(ref);
    const { categoryId, isLocal, eventClientId } = await this.assertValid(dto);

    const existing = await this.prisma.fleetVehicle.findFirst({
      where: {
        regNbr: { equals: dto.regNbr.trim(), mode: 'insensitive' },
        ref: { not: ref },
      },
    });
    if (existing) {
      throw new ConflictException(
        `A vehicle with registration "${dto.regNbr.trim()}" already exists`,
      );
    }

    // driverRef, unlike partnerCompany, is only touched when explicitly
    // present in the request body — most PUT callers (the Fleet "Edit"
    // popup) have no such field and must not silently wipe an existing
    // chauffeur link. A local vehicle always forces it null regardless.
    let driverId: string | null | undefined;
    if (!isLocal) {
      if (dto.driverRef !== undefined) {
        driverId = await this.resolveDriverId(dto.driverRef, ref);
      }
    } else {
      driverId = null;
    }

    const vehicle = await this.prisma.fleetVehicle.update({
      where: { ref },
      data: {
        categoryId,
        regNbr: dto.regNbr.trim(),
        make: dto.make,
        model: dto.model,
        yearOfBuild: dto.yearOfBuild,
        fourWD: dto.fourWD,
        nbPax: dto.nbPax,
        color: dto.color || FLEET_DEFAULT_COLOR,
        acronym: dto.acronym?.trim().slice(0, 6) || null,
        isLocal,
        countryCode: !isLocal ? dto.countryCode || null : null,
        area: !isLocal ? dto.area?.trim() || null : null,
        partnerCompany: !isLocal ? dto.partnerCompany?.trim() || null : null,
        ...(driverId !== undefined && { driverId }),
        eventsOnly: !!dto.eventsOnly,
        eventCountry: dto.eventsOnly ? dto.eventCountry || null : null,
        eventArea: dto.eventsOnly ? dto.eventArea?.trim() || null : null,
        eventClientId,
      },
      include: { category: true, driver: true, unavailability: true },
    });
    return vehicle;
  }

  async delete(ref: string) {
    const vehicle = await this.findByRefOrThrow(ref);
    await this.prisma.$transaction([
      this.prisma.fleetUnavailability.deleteMany({
        where: { fleetVehicleId: vehicle.id },
      }),
      this.prisma.fleetVehicle.delete({ where: { ref } }),
    ]);
    return { ok: true };
  }

  async setActive(ref: string, active: boolean) {
    await this.findByRefOrThrow(ref);
    return this.prisma.fleetVehicle.update({
      where: { ref },
      data: { active },
      include: { category: true, driver: true, unavailability: true },
    });
  }

  async setDriver(ref: string, driverRef: string | null | undefined) {
    const vehicle = await this.findByRefOrThrow(ref);
    if (driverRef && vehicle.isLocal) {
      throw new BadRequestException(
        'A driver can only be reserved to a non-local (external) vehicle.',
      );
    }
    const driverId = await this.resolveDriverId(driverRef ?? undefined, ref);
    return this.prisma.fleetVehicle.update({
      where: { ref },
      data: { driverId },
      include: { category: true, driver: true, unavailability: true },
    });
  }

  async setUnavailability(ref: string, dto: SetFleetUnavailabilityDto) {
    const vehicle = await this.findByRefOrThrow(ref);
    if (!vehicle.isLocal) {
      throw new BadRequestException(
        'This is only available for Fleet - Internal vehicles.',
      );
    }
    if (
      dto.type === 'REPAIR' ||
      dto.type === 'SERVICE' ||
      dto.type === 'BODYWORK'
    ) {
      if (!dto.startDate || !dto.endDate) {
        throw new BadRequestException('Start date and end date are required.');
      }
      if (dto.endDate < dto.startDate) {
        throw new BadRequestException(
          'End date must be on or after the start date.',
        );
      }
    }

    await this.prisma.fleetUnavailability.deleteMany({
      where: { fleetVehicleId: vehicle.id },
    });
    if (dto.type) {
      await this.prisma.fleetUnavailability.create({
        data: {
          fleetVehicleId: vehicle.id,
          type: FleetUnavailKind[dto.type],
          startDate: new Date(dto.startDate!),
          endDate: new Date(dto.endDate!),
        },
      });
    }
    return this.prisma.fleetVehicle.findUnique({
      where: { ref },
      include: { category: true, driver: true, unavailability: true },
    });
  }

  async findByRefOrThrow(ref: string) {
    const vehicle = await this.prisma.fleetVehicle.findUnique({
      where: { ref },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }

  private async resolveDriverId(
    driverRef: string | undefined,
    excludeRef?: string,
  ): Promise<string | null> {
    if (!driverRef) return null;
    const driver = await this.prisma.driver.findUnique({
      where: { ref: driverRef },
    });
    if (!driver)
      throw new BadRequestException(
        'driverRef does not match an existing driver',
      );
    const reservedBy = await this.prisma.fleetVehicle.findUnique({
      where: { driverId: driver.id },
    });
    if (reservedBy && reservedBy.ref !== excludeRef) {
      throw new ConflictException(
        `Driver ${driverRef} is already reserved to vehicle ${reservedBy.ref}`,
      );
    }
    return driver.id;
  }

  private async assertValid(
    dto: CreateFleetVehicleDto,
  ): Promise<ValidatedFleetVehicle> {
    const isLocal = dto.isLocal === undefined ? true : dto.isLocal;
    if (!isLocal) {
      if (!dto.countryCode) {
        throw new BadRequestException(
          'country is required for an external (non-local) vehicle',
        );
      }
      if (!dto.area?.trim()) {
        throw new BadRequestException(
          'area is required for an external (non-local) vehicle',
        );
      }
      if (!dto.partnerCompany?.trim()) {
        throw new BadRequestException(
          'partnerCompany is required for an external (non-local) vehicle',
        );
      }
    }

    const category = await this.prisma.vehicleType.findUnique({
      where: { name: dto.category },
    });
    if (!category) {
      throw new BadRequestException(
        'category is required and must match an existing vehicle type',
      );
    }
    if (!dto.regNbr.trim()) {
      throw new BadRequestException('regNbr is required');
    }
    if (!FLEET_MAKES.includes(dto.make)) {
      throw new BadRequestException('invalid make');
    }
    if (!FLEET_MODELS_BY_MAKE[dto.make]?.includes(dto.model)) {
      throw new BadRequestException('invalid model for this make');
    }
    const categoryModels = CATEGORY_MODELS[dto.category];
    if (categoryModels && !categoryModels[dto.make]?.includes(dto.model)) {
      throw new BadRequestException(
        `${dto.make} ${dto.model} is not a valid vehicle for the "${dto.category}" Category`,
      );
    }
    const { min, max } = getFleetYearWindow();
    if (dto.yearOfBuild < min || dto.yearOfBuild > max) {
      throw new BadRequestException(`yob must be between ${min} and ${max}`);
    }
    if (dto.nbPax < 0 || dto.nbPax > 50) {
      throw new BadRequestException('nbPax must be between 0 and 50');
    }
    if (dto.color && !FLEET_COLOR_VALUES.includes(dto.color)) {
      throw new BadRequestException('invalid color');
    }

    const eventClientId = dto.eventsOnly
      ? await this.eventLink.resolveEventClientId(
          dto.eventCountry,
          dto.eventArea,
          dto.eventRef,
        )
      : null;

    return { categoryId: category.id, isLocal, eventClientId };
  }
}
