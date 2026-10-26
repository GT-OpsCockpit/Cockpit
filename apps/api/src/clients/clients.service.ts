import {
  BadRequestException,
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
import { assertRequiredFields } from '../common/business/assert-required-fields';
import type { AuthenticatedUser } from '../common/guards/session-auth.guard';
import { CreateClientDto } from './dto/create-client.dto';
import { CreateClientContactDto } from './dto/create-client-contact.dto';
import { UpdateClientContactDto } from './dto/update-client-contact.dto';
import { ReorderClientContactsDto } from './dto/reorder-client-contacts.dto';
import { ClientContactEntity } from './dto/client-contact.entity';
import { UpdateClientDto } from './dto/update-client.dto';
import { ListClientsQueryDto } from './dto/list-clients-query.dto';
import { ClientEntity } from './dto/client.entity';
import { ClientListEntity } from './dto/client-list.entity';
import { PriceListEntity } from '../price-lists/dto/price-list.entity';
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
    if (query.excludeType) where.clientType = { not: query.excludeType };

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

  async create(
    dto: CreateClientDto,
    user: AuthenticatedUser,
  ): Promise<ClientEntity> {
    const isEvent = dto.clientType === ClientType.EVENT;
    assertRequiredFields('client', dto);

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
    const email = dto.email?.trim() ? normalizeEmail(dto.email) : null;
    if (email) {
      this.assertValidEmailFormat(email, 'email address');
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
    const isEvent = clientType === ClientType.EVENT;
    // The values as they will be *after* the write, not as they arrived: a
    // PATCH that touches nothing must not fail on a field the stored row
    // already carries. Getting this merge wrong here is how the create/update
    // event-field bugs happened.
    assertRequiredFields('client', {
      clientType,
      company: dto.company ?? existing.company,
      contactFirstName: dto.contactFirstName ?? existing.contactFirstName,
      contactLastName: dto.contactLastName ?? existing.contactLastName,
      eventCountry: dto.eventCountry ?? existing.eventCountry,
      eventArea: dto.eventArea ?? existing.eventArea,
      eventStartDate: dto.eventStartDate ?? existing.eventStartDate,
      eventEndDate: dto.eventEndDate ?? existing.eventEndDate,
    });

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

  /** Every price list currently applicable to this client. */
  async listPriceLists(ref: string): Promise<PriceListEntity[]> {
    await this.findByRefOrThrow(ref);
    const priceLists = await this.prisma.priceList.findMany({
      where: { clients: { some: { ref } } },
      include: {
        entries: { include: { vehicleType: true }, orderBy: { createdAt: 'asc' } },
        clients: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    // `.name` on a Client is derived (withName below), never a real column —
    // a Client row picked up through this raw `include: { clients: true }`
    // arrives without it, same reasoning as passengers.service.ts's own
    // identical fix.
    return priceLists.map((pl) => ({
      ...pl,
      clients: pl.clients.map((c) => ({ ...c, name: clientDisplayName(c) })),
    }));
  }

  /** Replaces the full set of price lists applicable to this client. */
  async setPriceLists(
    ref: string,
    priceListRefs: string[],
  ): Promise<PriceListEntity[]> {
    await this.findByRefOrThrow(ref);
    if (priceListRefs.length > 0) {
      const found = await this.prisma.priceList.findMany({
        where: { ref: { in: priceListRefs } },
        select: { ref: true },
      });
      const missing = priceListRefs.filter(
        (r) => !found.some((f) => f.ref === r),
      );
      if (missing.length > 0) {
        throw new BadRequestException(
          `Price list(s) not found: ${missing.join(', ')}`,
        );
      }
    }
    await this.prisma.client.update({
      where: { ref },
      data: { priceLists: { set: priceListRefs.map((r) => ({ ref: r })) } },
    });
    return this.listPriceLists(ref);
  }

  /** All contacts for this client, in their chosen order — that order is what "POC 1, POC 2…" numbers against in the UI, and what a new booking's POC field defaults to (the first one). `createdAt` only breaks ties between rows that happen to share an `order`. */
  async listContacts(ref: string): Promise<ClientContactEntity[]> {
    const client = await this.findByRefOrThrow(ref);
    return this.prisma.clientContact.findMany({
      where: { clientId: client.id },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async addContact(
    ref: string,
    dto: CreateClientContactDto,
  ): Promise<ClientContactEntity> {
    const client = await this.findByRefOrThrow(ref);
    // Appended at the end of this client's current order, not left at the
    // shared default of 0 — a client with contacts already reordered by
    // drag-and-drop shouldn't have a new one jump to the top.
    const last = await this.prisma.clientContact.aggregate({
      where: { clientId: client.id },
      _max: { order: true },
    });
    const order = (last._max.order ?? -1) + 1;
    return this.prisma.clientContact.create({
      data: { clientId: client.id, name: dto.name, phone: dto.phone, email: dto.email, order },
    });
  }

  /**
   * Applies a new drag-and-dropped order to this client's contacts.
   * `contactIds` must be exactly this client's current contact ids, just
   * reshuffled — anything missing, extra, or foreign is refused rather than
   * silently reconciled, since a stale list from the browser could otherwise
   * drop a contact from the order without anyone noticing.
   */
  async reorderContacts(
    ref: string,
    dto: ReorderClientContactsDto,
  ): Promise<ClientContactEntity[]> {
    const existing = await this.listContacts(ref);
    const existingIds = new Set(existing.map((c) => c.id));
    const requestedIds = new Set(dto.contactIds);
    if (
      existingIds.size !== requestedIds.size ||
      dto.contactIds.some((id) => !existingIds.has(id))
    ) {
      throw new BadRequestException(
        'The new order must include every contact on this account exactly once.',
      );
    }
    await this.prisma.$transaction(
      dto.contactIds.map((id, index) =>
        this.prisma.clientContact.update({
          where: { id },
          data: { order: index },
        }),
      ),
    );
    return this.listContacts(ref);
  }

  async updateContact(
    ref: string,
    contactId: string,
    dto: UpdateClientContactDto,
  ): Promise<ClientContactEntity> {
    await this.findContactOrThrow(ref, contactId);
    return this.prisma.clientContact.update({
      where: { id: contactId },
      data: { name: dto.name, phone: dto.phone, email: dto.email },
    });
  }

  async deleteContact(ref: string, contactId: string): Promise<OkResponseEntity> {
    await this.findContactOrThrow(ref, contactId);
    await this.prisma.clientContact.delete({ where: { id: contactId } });
    return { ok: true };
  }

  private async findContactOrThrow(ref: string, contactId: string) {
    const contacts = await this.listContacts(ref);
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) throw new NotFoundException('Contact not found on this client');
    return contact;
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
}
