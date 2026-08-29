import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import {
  clientDisplayName,
  driverDisplayName,
  isValidEmail,
  normalizeEmail,
} from '@cockpit/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RefCounterService } from '../common/ref-counter/ref-counter.service';
import { normalizePhone } from '../common/utils/normalize-phone';
import { searchTokensFilter } from '../common/utils/search-tokens';
import {
  outsideEventWindowFilter,
  todayUtcMidnight,
} from '../common/business/assignability';
import { ReactivateDto } from './dto/reactivate.dto';
import { ReactivateResponseEntity } from './dto/reactivate-response.entity';
import { ReactivationCandidatesEntity } from './dto/reactivation-candidates.entity';
import { can } from '../common/permissions/permissions';
import type { AuthenticatedUser } from '../common/guards/session-auth.guard';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ListClientsQueryDto } from './dto/list-clients-query.dto';
import { ClientEntity } from './dto/client.entity';
import { ClientListEntity } from './dto/client-list.entity';
import { OkResponseEntity } from '../common/dto/ok-response.entity';
import { ClientType } from '../../generated/prisma/enums';
import type { Client, Prisma } from '../../generated/prisma/client';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

// Same reference zone as TripsService's urgency/period-window logic.
const PARIS_ZONE = 'Europe/Paris';

const REF_PREFIX: Record<ClientType, string> = {
  [ClientType.INDIVIDUAL]: 'CI',
  [ClientType.COMPANY]: 'CC',
  [ClientType.EVENT]: 'CE',
};
const REF_SCOPE: Record<ClientType, string> = {
  [ClientType.INDIVIDUAL]: 'client:individual',
  [ClientType.COMPANY]: 'client:company',
  [ClientType.EVENT]: 'client:event',
};

export type ClientWithName = Client & { name: string };

function withName<T extends Client>(client: T): T & { name: string } {
  return { ...client, name: clientDisplayName(client) };
}

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refCounter: RefCounterService,
  ) {}

  async list(query: ListClientsQueryDto): Promise<ClientListEntity> {
    const where: Prisma.ClientWhereInput = {};
    if (!query.includeInactive) where.active = true;
    if (query.type) where.clientType = query.type;

    // Same rules EventLinkService enforces on write (see
    // ListClientsQueryDto): an Event is linkable only if it hasn't ended and
    // happens where the record is. Area comparison is case-insensitive and
    // trimmed, matching the legacy's locAreaKey.
    if (query.eventCountry) where.eventCountry = query.eventCountry;
    if (query.eventArea?.trim()) {
      where.eventArea = { equals: query.eventArea.trim(), mode: 'insensitive' };
    }
    if (query.eventNotEnded) {
      // The null branch mirrors the legacy's `!c.eventEndDate ||` and
      // withinEventWindow: the column is nullable, and a record with no end
      // date on file is not evidence that the event is over.
      where.OR = [
        { eventEndDate: null },
        { eventEndDate: { gte: todayUtcMidnight() } },
      ];
    }

    // `name` is derived (clientDisplayName), not a column — search the fields
    // it's derived from instead, plus ref/email/acronym. Token by token, so a
    // full name typed as "Marc Dubois" spans contactFirstName + contactLastName
    // (see searchTokensFilter).
    const searchFilter = searchTokensFilter(query.search, [
      'ref',
      'company',
      'contactFirstName',
      'contactLastName',
      'email',
      'acronym',
    ]);
    if (searchFilter) where.AND = searchFilter.AND;

    // Always bounded — no "give me everything" mode. Bookings' client
    // combobox (and anything else that used to want the full roster) now
    // does request-on-demand search against this same endpoint with a small
    // `limit`, same shape as the Clients management table's pagination.
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const [clients, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.client.count({ where }),
    ]);
    return { data: clients.map(withName), total, page, limit };
  }

  // TODO: this type-discriminated required-fields tree is duplicated, each
  // in its own shape, in DriversService.assertValidDriverFields() and
  // FleetVehiclesService.assertValid(). Extract a shared "required fields by
  // discriminant" helper so a fix to one doesn't have to be repeated in the
  // other two (this is exactly how the create/update event-field bugs
  // happened here).
  async create(
    dto: CreateClientDto,
    user: AuthenticatedUser,
  ): Promise<ClientEntity> {
    const isCompany = dto.clientType === ClientType.COMPANY;
    const isEvent = dto.clientType === ClientType.EVENT;
    if (isCompany && !dto.company) {
      throw new BadRequestException(
        'Company name is required for a Company-type account.',
      );
    }
    if (isEvent && !dto.company) {
      throw new BadRequestException(
        'Event name is required for an Events-type account.',
      );
    }
    if (
      isEvent &&
      !(
        dto.eventCountry &&
        dto.eventArea &&
        dto.eventStartDate &&
        dto.eventEndDate
      )
    ) {
      throw new BadRequestException(
        'Country, area and date range are required for an Events-type account.',
      );
    }
    // Ported from the legacy's separate OWNER_PASSWORD gate on creating an
    // event in the past (events.html:437-444) — see docs/agents/permissions.md.
    if (isEvent && dto.eventStartDate) {
      const todayParis = DateTime.now().setZone(PARIS_ZONE).toISODate();
      if (
        dto.eventStartDate < todayParis! &&
        !can(user, 'client:create-past-event')
      ) {
        throw new ForbiddenException(
          'Creating an event with a past start date requires the Admin role.',
        );
      }
    }
    if (
      !isCompany &&
      !isEvent &&
      !(dto.contactFirstName && dto.contactLastName)
    ) {
      throw new BadRequestException(
        'Contact first name and last name are required for an Individual-type account.',
      );
    }

    const email = dto.email?.trim() ? normalizeEmail(dto.email) : null;
    if (email) {
      this.assertValidEmailFormat(email, 'email address');
      await this.assertEmailAvailable(email);
    }
    const pocEmail = dto.pocEmail?.trim() ? normalizeEmail(dto.pocEmail) : null;
    if (pocEmail) this.assertValidEmailFormat(pocEmail, 'POC email address');

    const seq = await this.refCounter.next(REF_SCOPE[dto.clientType]);
    const ref = `${REF_PREFIX[dto.clientType]}${seq}`;
    const contactFullName = [dto.contactFirstName, dto.contactLastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    const client = await this.prisma.client.create({
      data: {
        ref,
        clientType: dto.clientType,
        contactFirstName: dto.contactFirstName || null,
        contactLastName: dto.contactLastName || null,
        company: dto.company || null,
        acronym: dto.acronym || null,
        refPoOther: dto.refPoOther || null,
        address: dto.address || null,
        postalCode: dto.postalCode || null,
        city: dto.city || null,
        countryCode: dto.countryCode || null,
        vatNumber: dto.vatNumber || null,
        email,
        billing: dto.billing,
        pocName: dto.pocName?.trim() || contactFullName || null,
        pocPhone: normalizePhone(dto.pocPhone),
        pocEmail,
        eventCountry: isEvent ? dto.eventCountry || null : null,
        eventArea: isEvent ? dto.eventArea || null : null,
        eventStartDate:
          isEvent && dto.eventStartDate ? new Date(dto.eventStartDate) : null,
        eventEndDate:
          isEvent && dto.eventEndDate ? new Date(dto.eventEndDate) : null,
      },
    });
    return withName(client);
  }

  async update(ref: string, dto: UpdateClientDto): Promise<ClientEntity> {
    const existing = await this.findByRefOrThrow(ref);

    const clientType = dto.clientType ?? existing.clientType;
    const isCompany = clientType === ClientType.COMPANY;
    const isEvent = clientType === ClientType.EVENT;
    if (isCompany && !(dto.company ?? existing.company)) {
      throw new BadRequestException(
        'Company name is required for a Company-type account.',
      );
    }
    if (isEvent && !(dto.company ?? existing.company)) {
      throw new BadRequestException(
        'Event name is required for an Events-type account.',
      );
    }
    if (
      isEvent &&
      !(
        (dto.eventCountry ?? existing.eventCountry) &&
        (dto.eventArea ?? existing.eventArea) &&
        (dto.eventStartDate ?? existing.eventStartDate) &&
        (dto.eventEndDate ?? existing.eventEndDate)
      )
    ) {
      throw new BadRequestException(
        'Country, area and date range are required for an Events-type account.',
      );
    }
    if (
      !isCompany &&
      !isEvent &&
      !(
        (dto.contactFirstName ?? existing.contactFirstName) &&
        (dto.contactLastName ?? existing.contactLastName)
      )
    ) {
      throw new BadRequestException(
        'Contact first name and last name are required for an Individual-type account.',
      );
    }

    const mergedFirst =
      dto.contactFirstName !== undefined
        ? dto.contactFirstName || null
        : existing.contactFirstName;
    const mergedLast =
      dto.contactLastName !== undefined
        ? dto.contactLastName || null
        : existing.contactLastName;
    const contactFullName = [mergedFirst, mergedLast]
      .filter(Boolean)
      .join(' ')
      .trim();

    // `undefined` means "the caller isn't touching this field" (mirrors the
    // ...(dto.x !== undefined && {...}) spreads below) — distinct from `null`,
    // which means "the caller is clearing it".
    let email: string | null | undefined;
    if (dto.email !== undefined) {
      email = dto.email?.trim() ? normalizeEmail(dto.email) : null;
      if (email) {
        this.assertValidEmailFormat(email, 'email address');
        await this.assertEmailAvailable(email, existing.id);
      }
    }
    let pocEmail: string | null | undefined;
    if (dto.pocEmail !== undefined) {
      pocEmail = dto.pocEmail?.trim() ? normalizeEmail(dto.pocEmail) : null;
      if (pocEmail) this.assertValidEmailFormat(pocEmail, 'POC email address');
    }

    const client = await this.prisma.client.update({
      where: { ref },
      data: {
        ...(dto.clientType !== undefined && { clientType: dto.clientType }),
        eventCountry: isEvent
          ? (dto.eventCountry ?? existing.eventCountry) || null
          : null,
        eventArea: isEvent
          ? (dto.eventArea ?? existing.eventArea) || null
          : null,
        eventStartDate: isEvent
          ? dto.eventStartDate
            ? new Date(dto.eventStartDate)
            : existing.eventStartDate
          : null,
        eventEndDate: isEvent
          ? dto.eventEndDate
            ? new Date(dto.eventEndDate)
            : existing.eventEndDate
          : null,
        ...(dto.contactFirstName !== undefined && {
          contactFirstName: dto.contactFirstName || null,
        }),
        ...(dto.contactLastName !== undefined && {
          contactLastName: dto.contactLastName || null,
        }),
        ...(dto.company !== undefined && { company: dto.company || null }),
        ...(dto.acronym !== undefined && { acronym: dto.acronym || null }),
        ...(dto.refPoOther !== undefined && {
          refPoOther: dto.refPoOther || null,
        }),
        ...(dto.address !== undefined && { address: dto.address || null }),
        ...(dto.postalCode !== undefined && {
          postalCode: dto.postalCode || null,
        }),
        ...(dto.city !== undefined && { city: dto.city || null }),
        ...(dto.countryCode !== undefined && {
          countryCode: dto.countryCode || null,
        }),
        ...(dto.vatNumber !== undefined && {
          vatNumber: dto.vatNumber || null,
        }),
        ...(email !== undefined && { email }),
        ...(dto.billing !== undefined && { billing: dto.billing }),
        ...(dto.pocName !== undefined && {
          pocName: dto.pocName.trim() || contactFullName || null,
        }),
        ...(dto.pocPhone !== undefined && {
          pocPhone: normalizePhone(dto.pocPhone),
        }),
        ...(pocEmail !== undefined && { pocEmail }),
      },
    });
    return withName(client);
  }

  async delete(ref: string): Promise<OkResponseEntity> {
    const client = await this.findByRefOrThrow(ref);
    const [tripCount, invoiceCount] = await Promise.all([
      this.prisma.trip.count({ where: { clientId: client.id } }),
      this.prisma.invoice.count({ where: { clientId: client.id } }),
    ]);
    if (tripCount > 0 || invoiceCount > 0) {
      throw new BadRequestException(
        'This account has trips or invoices on file and cannot be deleted — deactivate it instead.',
      );
    }
    await this.prisma.client.delete({ where: { ref } });
    return { ok: true };
  }

  async setActive(ref: string, active: boolean): Promise<ClientEntity> {
    await this.findByRefOrThrow(ref);
    const client = await this.prisma.client.update({
      where: { ref },
      data: { active },
    });
    return withName(client);
  }

  async findByRefOrThrow(ref: string) {
    const client = await this.prisma.client.findUnique({ where: { ref } });
    if (!client) throw new NotFoundException('Account not found');
    return client;
  }

  /**
   * Dormant Events drivers and vehicles that could be relinked to this Event.
   *
   * A venue or a region often hosts a returning event — the same Gala every
   * year — and the crew set up for last year's edition is still on file,
   * scoped to it and therefore inactive. The legacy offered to relink them in
   * one step right after the new Events account was created, rather than
   * having them re-entered from scratch (offerEventReactivation,
   * common.js:3912).
   *
   * A candidate is: an Events record based where this Event happens, still
   * scoped to a *different* Event, and currently outside that Event's dates.
   * Matched on the record's own Country/Area, which since the §4.3 port is
   * the same thing as its event link's location (see EventLinkService).
   */
  async listReactivationCandidates(
    ref: string,
  ): Promise<ReactivationCandidatesEntity> {
    const event = await this.findByRefOrThrow(ref);
    if (event.clientType !== ClientType.EVENT) {
      throw new BadRequestException('This account is not an Events account.');
    }
    if (!event.eventCountry || !event.eventArea?.trim()) {
      return { drivers: [], fleetVehicles: [] };
    }

    const where = {
      active: true,
      countryCode: event.eventCountry,
      area: { equals: event.eventArea.trim(), mode: 'insensitive' as const },
      NOT: { eventClientId: event.id },
      ...outsideEventWindowFilter(todayUtcMidnight()),
    };

    const [drivers, fleetVehicles] = await Promise.all([
      this.prisma.driver.findMany({
        where,
        include: { eventClient: true },
        orderBy: { ref: 'asc' },
      }),
      this.prisma.fleetVehicle.findMany({
        where,
        include: { eventClient: true, category: true },
        orderBy: { ref: 'asc' },
      }),
    ]);

    const previous = (client: { ref: string; company: string | null }) => ({
      previousEventRef: client.ref,
      previousEventName: client.company ?? client.ref,
    });

    return {
      drivers: drivers.map((d) => ({
        ref: d.ref,
        label: driverDisplayName(d),
        ...previous(d.eventClient!),
      })),
      fleetVehicles: fleetVehicles.map((v) => ({
        ref: v.ref,
        label: `${v.regNbr} (${v.category.name})`,
        ...previous(v.eventClient!),
      })),
    };
  }

  /**
   * Relinks the chosen candidates to this Event. One transaction rather than
   * the legacy's N sequential PUTs, so a half-applied batch can't happen.
   * Only records listReactivationCandidates would have offered are accepted —
   * the refs come from a form, so they are re-checked, not trusted.
   */
  async reactivate(
    ref: string,
    dto: ReactivateDto,
  ): Promise<ReactivateResponseEntity> {
    const event = await this.findByRefOrThrow(ref);
    const candidates = await this.listReactivationCandidates(ref);

    const keep = (asked: string[] | undefined, offered: { ref: string }[]) => {
      const allowed = new Set(offered.map((c) => c.ref));
      const requested = asked ?? [];
      const kept = requested.filter((r) => allowed.has(r));
      if (kept.length !== requested.length) {
        throw new BadRequestException(
          'One of the selected records can no longer be relinked to this Event — reopen the list.',
        );
      }
      return kept;
    };

    const driverRefs = keep(dto.driverRefs, candidates.drivers);
    const fleetVehicleRefs = keep(
      dto.fleetVehicleRefs,
      candidates.fleetVehicles,
    );
    const link = {
      eventsOnly: true,
      eventCountry: event.eventCountry,
      eventArea: event.eventArea,
      eventClientId: event.id,
    };

    await this.prisma.$transaction([
      this.prisma.driver.updateMany({
        where: { ref: { in: driverRefs } },
        data: link,
      }),
      this.prisma.fleetVehicle.updateMany({
        where: { ref: { in: fleetVehicleRefs } },
        data: link,
      }),
    ]);

    return {
      ok: true,
      drivers: driverRefs.length,
      fleetVehicles: fleetVehicleRefs.length,
    };
  }

  private assertValidEmailFormat(email: string, fieldLabel: string): void {
    if (!isValidEmail(email)) {
      throw new BadRequestException(`Please enter a valid ${fieldLabel}.`);
    }
  }

  /** `excludeId` lets update() ignore the record it's editing when checking for a conflict. */
  private async assertEmailAvailable(
    email: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.prisma.client.findUnique({ where: { email } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException('An account with this email already exists.');
    }
  }
}
