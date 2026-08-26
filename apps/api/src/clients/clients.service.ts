import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RefCounterService } from '../common/ref-counter/ref-counter.service';
import { normalizePhone } from '../common/utils/normalize-phone';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ClientType } from '../../generated/prisma/enums';
import type { Client } from '../../generated/prisma/client';

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

/** Company name if set, else the contact's full name, else a generic fallback — never stored, always derived. */
export function computeClientName(client: {
  ref: string;
  company: string | null;
  contactFirstName: string | null;
  contactLastName: string | null;
}): string {
  const contactFullName = [client.contactFirstName, client.contactLastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  return client.company?.trim() || contactFullName || `Account ${client.ref}`;
}

function withName<T extends Client>(client: T): T & { name: string } {
  return { ...client, name: computeClientName(client) };
}

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refCounter: RefCounterService,
  ) {}

  async list() {
    const clients = await this.prisma.client.findMany();
    clients.sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.ref.localeCompare(b.ref);
    });
    return clients.map(withName);
  }

  // TODO: this type-discriminated required-fields tree is duplicated, each
  // in its own shape, in DriversService.assertValidDriverFields() and
  // FleetVehiclesService.assertValid(). Extract a shared "required fields by
  // discriminant" helper so a fix to one doesn't have to be repeated in the
  // other two (this is exactly how the create/update event-field bugs
  // happened here).
  async create(dto: CreateClientDto) {
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
    if (
      !isCompany &&
      !isEvent &&
      !(dto.contactFirstName && dto.contactLastName)
    ) {
      throw new BadRequestException(
        'Contact first name and last name are required for an Individual-type account.',
      );
    }

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
        email: dto.email || null,
        billing: dto.billing,
        pocName: dto.pocName?.trim() || contactFullName || null,
        pocPhone: normalizePhone(dto.pocPhone),
        pocEmail: dto.pocEmail || null,
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

  async update(ref: string, dto: UpdateClientDto) {
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
        ...(dto.email !== undefined && { email: dto.email || null }),
        ...(dto.billing !== undefined && { billing: dto.billing }),
        ...(dto.pocName !== undefined && {
          pocName: dto.pocName.trim() || contactFullName || null,
        }),
        ...(dto.pocPhone !== undefined && {
          pocPhone: normalizePhone(dto.pocPhone),
        }),
        ...(dto.pocEmail !== undefined && { pocEmail: dto.pocEmail || null }),
      },
    });
    return withName(client);
  }

  async delete(ref: string) {
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

  async setActive(ref: string, active: boolean) {
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
}
