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
import { normalizePhone } from '../common/utils/normalize-phone';
import { letters } from '../common/utils/letters';
import { computeDriverName } from '../common/utils/driver-name';
import { can } from '../common/permissions/permissions';
import type { AuthenticatedUser } from '../common/guards/session-auth.guard';
import { CreateDriverDto } from './dto/create-driver.dto';
import { SetDriverUnavailabilityDto } from './dto/set-unavailability.dto';
import { ListDriversQueryDto } from './dto/list-drivers-query.dto';
import {
  DriverEntity,
  DriverWithUnavailabilityEntity,
} from './dto/driver.entity';
import { DriverListEntity } from './dto/driver-list.entity';
import { OkResponseEntity } from '../common/dto/ok-response.entity';
import { DriverUnavailKind } from '../../generated/prisma/enums';
import type {
  Client,
  Driver,
  DriverUnavailability,
  FleetVehicle,
  Prisma,
} from '../../generated/prisma/client';

const DRIVER_INCLUDE = {
  eventClient: true,
  unavailability: true,
  fleetReserved: true,
} satisfies Prisma.DriverInclude;

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

/** Same required-fields tree as the legacy's validateDriverFields(), shared by create and update. */
function assertValidDriverFields(dto: CreateDriverDto): void {
  if (dto.eventsOnly) {
    if (!dto.company?.trim())
      throw new BadRequestException('company is required for an Events driver');
    if (!dto.firstName?.trim())
      throw new BadRequestException(
        'firstName is required for an Events driver',
      );
    if (!dto.lastName?.trim())
      throw new BadRequestException(
        'lastName is required for an Events driver',
      );
    if (!dto.email?.trim())
      throw new BadRequestException('email is required for an Events driver');
    if (!dto.phone?.trim())
      throw new BadRequestException('phone is required for an Events driver');
    return;
  }
  const isPartner = !!dto.company?.trim();
  const hasName = !!dto.firstName?.trim() || !!dto.lastName?.trim();
  if (!isPartner) {
    if (!dto.firstName || !dto.lastName || !dto.phone) {
      throw new BadRequestException(
        'firstName, lastName and phone are required',
      );
    }
    return;
  }
  if (hasName) {
    if (!dto.email?.trim())
      throw new BadRequestException(
        'email is required for a partner chauffeur',
      );
    if (!dto.phone?.trim())
      throw new BadRequestException(
        'phone is required for a partner chauffeur',
      );
    return;
  }
  if (!dto.email?.trim()) {
    throw new BadRequestException(
      'email is required when Company is set (partner)',
    );
  }
}

function driverRefPrefix(
  countryCode: string | undefined,
  area: string | undefined,
  company: string | undefined,
): string {
  if (!company?.trim()) return 'D-FR-INT';
  const countryPart = (countryCode ?? '').split('-')[0].toUpperCase() || 'XX';
  const areaPart = letters(area, 2) || 'XX';
  const companyPart = letters(company, 3) || 'XXX';
  return `D-${countryPart}-${areaPart}-${companyPart}`;
}

function withName<
  T extends Driver & {
    eventClient: Client | null;
    unavailability: DriverUnavailability | null;
    fleetReserved: FleetVehicle | null;
  },
>(driver: T): T & { name: string } {
  return { ...driver, name: computeDriverName(driver) };
}

@Injectable()
export class DriversService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refCounter: RefCounterService,
    private readonly eventLink: EventLinkService,
  ) {}

  async list(query: ListDriversQueryDto): Promise<DriverListEntity> {
    const where: Prisma.DriverWhereInput = {};
    if (!query.includeInactive) where.active = true;

    const search = query.search?.trim();
    if (search) {
      // `name` is derived (computeDriverName), not a column — search the
      // fields it's derived from instead, plus ref/email/phone.
      where.OR = [
        { ref: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const [drivers, total] = await Promise.all([
      this.prisma.driver.findMany({
        where,
        include: DRIVER_INCLUDE,
        orderBy: [{ active: 'desc' }, { ref: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.driver.count({ where }),
    ]);
    return { data: drivers.map(withName), total, page, limit };
  }

  async create(dto: CreateDriverDto): Promise<DriverEntity> {
    assertValidDriverFields(dto);

    if (dto.phone) {
      const existing = await this.prisma.driver.findUnique({
        where: { phone: normalizePhone(dto.phone) },
        include: DRIVER_INCLUDE,
      });
      if (existing) return withName(existing);
    }

    const eventClientId = dto.eventsOnly
      ? await this.eventLink.resolveEventClientId(
          dto.eventCountry,
          dto.eventArea,
          dto.eventRef,
        )
      : null;

    const prefix = driverRefPrefix(dto.countryCode, dto.area, dto.company);
    const seq = await this.refCounter.next(`driver:${prefix}`);
    const ref = `${prefix}-${String(seq).padStart(3, '0')}`;

    const driver = await this.prisma.driver.create({
      data: {
        ref,
        countryCode: dto.countryCode || null,
        firstName: dto.firstName,
        lastName: dto.lastName,
        // null (not '') when absent: phone is a real unique column, and
        // multiple phone-less partner companies must not collide on ''.
        phone: dto.phone ? normalizePhone(dto.phone) : null,
        company: dto.company || null,
        email: dto.email || null,
        area: dto.area?.trim() || 'Local',
        eventsOnly: !!dto.eventsOnly,
        eventCountry: dto.eventsOnly ? dto.eventCountry || null : null,
        eventArea: dto.eventsOnly ? dto.eventArea?.trim() || null : null,
        eventClientId,
      },
      include: DRIVER_INCLUDE,
    });
    return withName(driver);
  }

  async update(ref: string, dto: CreateDriverDto): Promise<DriverEntity> {
    const existing = await this.findByRefOrThrow(ref);
    assertValidDriverFields(dto);

    if (dto.phone !== undefined && dto.phone) {
      const normalized = normalizePhone(dto.phone);
      if (normalized !== existing.phone) {
        const conflict = await this.prisma.driver.findUnique({
          where: { phone: normalized },
        });
        if (conflict && conflict.ref !== ref) {
          throw new ConflictException(
            `Phone ${dto.phone} is already used by driver ${conflict.ref}`,
          );
        }
      }
    }

    const finalEventsOnly = dto.eventsOnly ?? existing.eventsOnly;
    let eventClientId: string | null | undefined;
    if (finalEventsOnly) {
      // Legacy re-links on every PUT of an Events driver: eventCountry/Area/Ref
      // must come from the request, not merged with the stored record.
      eventClientId = await this.eventLink.resolveEventClientId(
        dto.eventCountry,
        dto.eventArea,
        dto.eventRef,
      );
    } else if (dto.eventsOnly !== undefined) {
      eventClientId = null;
    }

    const driver = await this.prisma.driver.update({
      where: { ref },
      data: {
        ...(dto.countryCode !== undefined && {
          countryCode: dto.countryCode || null,
        }),
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.phone !== undefined && {
          phone: dto.phone ? normalizePhone(dto.phone) : null,
        }),
        ...(dto.company !== undefined && { company: dto.company || null }),
        ...(dto.email !== undefined && { email: dto.email || null }),
        ...(dto.area !== undefined && { area: dto.area.trim() || 'Local' }),
        ...(dto.eventsOnly !== undefined && { eventsOnly: dto.eventsOnly }),
        ...(finalEventsOnly
          ? {
              eventCountry: dto.eventCountry || null,
              eventArea: dto.eventArea?.trim() || null,
              eventClientId,
            }
          : eventClientId === null
            ? { eventCountry: null, eventArea: null, eventClientId: null }
            : {}),
      },
      include: DRIVER_INCLUDE,
    });
    return withName(driver);
  }

  async delete(ref: string): Promise<OkResponseEntity> {
    const driver = await this.findByRefOrThrow(ref);
    await this.prisma.$transaction([
      this.prisma.driverUnavailability.deleteMany({
        where: { driverId: driver.id },
      }),
      this.prisma.driver.delete({ where: { ref } }),
    ]);
    return { ok: true };
  }

  async setActive(
    ref: string,
    active: boolean,
    user: AuthenticatedUser,
  ): Promise<DriverEntity> {
    const existing = await this.findByRefOrThrow(ref);

    // Ported from the legacy's reactivation gate (common.js:3596) — only
    // turning a deactivated driver/partner back on needs driver:reactivate;
    // deactivating is ungated, same as ClientsService.setActive.
    if (active && !existing.active && !can(user, 'driver:reactivate')) {
      throw new ForbiddenException(
        'Reactivating a driver requires the Admin role.',
      );
    }

    const driver = await this.prisma.driver.update({
      where: { ref },
      data: { active },
      include: DRIVER_INCLUDE,
    });
    return withName(driver);
  }

  async setUnavailability(
    ref: string,
    dto: SetDriverUnavailabilityDto,
  ): Promise<DriverWithUnavailabilityEntity | null> {
    const driver = await this.findByRefOrThrow(ref);

    if (dto.type === 'OFF' && !dto.date) {
      throw new BadRequestException('Date is required for a day off.');
    }
    if (dto.type === 'HOLIDAYS' || dto.type === 'SICK') {
      if (!dto.startDate || !dto.endDate) {
        throw new BadRequestException(
          `Start date and end date are required for ${dto.type === 'SICK' ? 'sick leave' : 'holidays'}.`,
        );
      }
      if (dto.endDate < dto.startDate) {
        throw new BadRequestException(
          'End date must be on or after the start date.',
        );
      }
    }

    await this.prisma.driverUnavailability.deleteMany({
      where: { driverId: driver.id },
    });
    if (dto.type) {
      await this.prisma.driverUnavailability.create({
        data: {
          driverId: driver.id,
          type: DriverUnavailKind[dto.type],
          date: dto.type === 'OFF' ? new Date(dto.date!) : null,
          startDate: dto.type !== 'OFF' ? new Date(dto.startDate!) : null,
          endDate: dto.type !== 'OFF' ? new Date(dto.endDate!) : null,
        },
      });
    }

    return this.prisma.driver.findUnique({
      where: { ref },
      include: { unavailability: true },
    });
  }

  async findByRefOrThrow(ref: string) {
    const driver = await this.prisma.driver.findUnique({ where: { ref } });
    if (!driver) throw new NotFoundException('Driver not found');
    return driver;
  }
}
