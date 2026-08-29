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
import { searchTokensFilter } from '../common/utils/search-tokens';
import {
  driverEffectivelyActiveFilter,
  driverEligibilityFilter,
  todayUtcMidnight,
} from '../common/business/assignability';
import { can } from '../common/permissions/permissions';
import { assertRequiredFields } from '../common/business/assert-required-fields';
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
import { ClientType, DriverUnavailKind } from '../../generated/prisma/enums';
import type {
  Client,
  Driver,
  DriverUnavailability,
  FleetVehicle,
  Prisma,
} from '../../generated/prisma/client';

import { driverDisplayName } from '@cockpit/shared';
const DRIVER_INCLUDE = {
  eventClient: true,
  unavailability: true,
  fleetReserved: true,
} satisfies Prisma.DriverInclude;

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

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
  return { ...driver, name: driverDisplayName(driver) };
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

    // Assignment-picker rules, resolved here rather than by whoever renders
    // the dropdown: "is this driver available today" and "may this driver
    // service this booking" are business rules, and the list is paginated —
    // a client-side filter would only ever see the current page.
    const conditions: Prisma.DriverWhereInput[] = [];
    // `company` is normalised to null when blank (create/update below), so
    // "has a company" is exactly the legacy's `!!d.company`.
    if (query.partnersOnly) conditions.push({ company: { not: null } });
    if (query.availableOnly) {
      conditions.push(driverEffectivelyActiveFilter(todayUtcMidnight()));
    }
    if (query.tripClientRef) {
      const tripClient = await this.prisma.client.findUnique({
        where: { ref: query.tripClientRef },
        select: { clientType: true },
      });
      conditions.push(
        driverEligibilityFilter({
          isEvent: tripClient?.clientType === ClientType.EVENT,
          area: query.tripArea,
          countryCode: query.tripCountryCode,
          pickupLocation: query.tripPickupLocation,
          dropoffLocation: query.tripDropoffLocation,
        }),
      );
    }

    // `name` is derived (driverDisplayName), not a column — search the fields
    // it's derived from instead, plus ref/email/phone. Token by token, so
    // "Julien Petit" spans firstName + lastName (see searchTokensFilter).
    const searchFilter = searchTokensFilter(query.search, [
      'ref',
      'firstName',
      'lastName',
      'company',
      'email',
      'phone',
    ]);
    if (searchFilter) conditions.push(...searchFilter.AND);
    if (conditions.length) where.AND = conditions;

    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const [drivers, total] = await Promise.all([
      this.prisma.driver.findMany({
        where,
        include: DRIVER_INCLUDE,
        orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.driver.count({ where }),
    ]);
    return { data: drivers.map(withName), total, page, limit };
  }

  async create(dto: CreateDriverDto): Promise<DriverEntity> {
    assertRequiredFields('driver', dto);

    // null, never '': Driver.phone is a unique column, so several phone-less
    // partner companies would collide on '' but not on NULL.
    const phone = normalizePhone(dto.phone);
    if (phone) {
      const existing = await this.prisma.driver.findUnique({
        where: { phone },
        include: DRIVER_INCLUDE,
      });
      if (existing) return withName(existing);
    }

    const eventClientId = dto.eventsOnly
      ? await this.eventLink.resolveEventClientId({
          recordCountryCode: dto.countryCode,
          recordArea: dto.area,
          eventCountry: dto.eventCountry,
          eventArea: dto.eventArea,
          eventRef: dto.eventRef,
        })
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
        phone,
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
    assertRequiredFields('driver', dto);

    if (dto.phone !== undefined) {
      const normalized = normalizePhone(dto.phone);
      // Only a real number can collide — clearing the field writes NULL, and
      // NULL never equals NULL on a unique index.
      if (normalized && normalized !== existing.phone) {
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
      eventClientId = await this.eventLink.resolveEventClientId({
        // A PUT re-links from scratch, so the location comes from the request
        // just like the event does — falling back to the stored record for a
        // field the payload leaves out, same as every other merged field.
        recordCountryCode: dto.countryCode ?? existing.countryCode,
        recordArea: dto.area ?? existing.area,
        eventCountry: dto.eventCountry,
        eventArea: dto.eventArea,
        eventRef: dto.eventRef,
      });
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
        ...(dto.phone !== undefined && { phone: normalizePhone(dto.phone) }),
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
