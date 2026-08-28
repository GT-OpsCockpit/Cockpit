import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RefCounterService } from '../common/ref-counter/ref-counter.service';
import { EventLinkService } from '../common/event-link/event-link.service';
import { searchTokensFilter } from '../common/utils/search-tokens';
import {
  fleetVehicleEffectivelyActiveFilter,
  todayUtcMidnight,
} from '../common/business/assignability';
import { compatibleFleetCategories } from '../common/constants/vehicle-compatibility';
import { can } from '../common/permissions/permissions';
import type { AuthenticatedUser } from '../common/guards/session-auth.guard';
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
import { ListFleetVehiclesQueryDto } from './dto/list-fleet-vehicles-query.dto';
import { FleetVehicleEntity } from './dto/fleet-vehicle.entity';
import { FleetVehicleListEntity } from './dto/fleet-vehicle-list.entity';
import { OkResponseEntity } from '../common/dto/ok-response.entity';
import { FleetUnavailKind } from '../../generated/prisma/enums';
import type { Prisma } from '../../generated/prisma/client';

interface ValidatedFleetVehicle {
  categoryId: string;
  isLocal: boolean;
  eventClientId: string | null;
}

const FLEET_VEHICLE_INCLUDE = {
  category: true,
  driver: true,
  unavailability: true,
  eventClient: true,
} as const;

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

@Injectable()
export class FleetVehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refCounter: RefCounterService,
    private readonly eventLink: EventLinkService,
  ) {}

  async list(
    query: ListFleetVehiclesQueryDto,
  ): Promise<FleetVehicleListEntity> {
    const where: Prisma.FleetVehicleWhereInput = {};
    if (!query.includeInactive) where.active = true;

    // Same reasoning as DriversService.list(): "is this vehicle available
    // today" and "can it service this booking's Category" are business
    // rules, and the list is paginated — filtering the rendered page
    // client-side would silently hide vehicles instead of excluding them.
    const conditions: Prisma.FleetVehicleWhereInput[] = [];
    if (query.availableOnly) {
      conditions.push(fleetVehicleEffectivelyActiveFilter(todayUtcMidnight()));
    }
    if (query.compatibleWith) {
      conditions.push({
        category: {
          name: { in: compatibleFleetCategories(query.compatibleWith) },
        },
      });
    }

    // Token by token, so a vehicle typed the way it reads on screen
    // ("Mercedes V-Class") spans make + model (see searchTokensFilter).
    const searchFilter = searchTokensFilter(query.search, [
      'ref',
      'regNbr',
      'make',
      'model',
      'acronym',
    ]);
    if (searchFilter) conditions.push(...searchFilter.AND);
    if (conditions.length) where.AND = conditions;

    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const [vehicles, total] = await Promise.all([
      this.prisma.fleetVehicle.findMany({
        where,
        include: FLEET_VEHICLE_INCLUDE,
        orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.fleetVehicle.count({ where }),
    ]);
    return { data: vehicles, total, page, limit };
  }

  async create(dto: CreateFleetVehicleDto): Promise<FleetVehicleEntity> {
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
      include: FLEET_VEHICLE_INCLUDE,
    });
    return vehicle;
  }

  async update(
    ref: string,
    dto: CreateFleetVehicleDto,
  ): Promise<FleetVehicleEntity> {
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
      include: FLEET_VEHICLE_INCLUDE,
    });
    return vehicle;
  }

  async delete(ref: string): Promise<OkResponseEntity> {
    const vehicle = await this.findByRefOrThrow(ref);
    await this.prisma.$transaction([
      this.prisma.fleetUnavailability.deleteMany({
        where: { fleetVehicleId: vehicle.id },
      }),
      this.prisma.fleetVehicle.delete({ where: { ref } }),
    ]);
    return { ok: true };
  }

  async setActive(
    ref: string,
    active: boolean,
    user: AuthenticatedUser,
  ): Promise<FleetVehicleEntity> {
    const existing = await this.findByRefOrThrow(ref);

    // Ported from the legacy's reactivation gate (vehicles.html:574) — only
    // turning a deactivated vehicle back on needs vehicle:reactivate;
    // deactivating is ungated, same as DriversService.setActive.
    if (active && !existing.active && !can(user, 'vehicle:reactivate')) {
      throw new ForbiddenException(
        'Reactivating a vehicle requires the Admin role.',
      );
    }

    return this.prisma.fleetVehicle.update({
      where: { ref },
      data: { active },
      include: FLEET_VEHICLE_INCLUDE,
    });
  }

  async setDriver(
    ref: string,
    driverRef: string | null | undefined,
  ): Promise<FleetVehicleEntity> {
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
      include: FLEET_VEHICLE_INCLUDE,
    });
  }

  async setUnavailability(
    ref: string,
    dto: SetFleetUnavailabilityDto,
  ): Promise<FleetVehicleEntity | null> {
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
      include: FLEET_VEHICLE_INCLUDE,
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
      ? await this.eventLink.resolveEventClientId({
          // A Local vehicle stores no country/area of its own (see create()),
          // so it has no location an Event could match — the legacy refused
          // to open the link popup at all in that case.
          recordCountryCode: dto.isLocal ? null : dto.countryCode,
          recordArea: dto.isLocal ? null : dto.area,
          eventCountry: dto.eventCountry,
          eventArea: dto.eventArea,
          eventRef: dto.eventRef,
        })
      : null;

    return { categoryId: category.id, isLocal, eventClientId };
  }
}
