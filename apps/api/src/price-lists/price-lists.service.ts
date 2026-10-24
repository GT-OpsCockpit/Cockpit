import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RefCounterService } from '../common/ref-counter/ref-counter.service';
import { clientDisplayName } from '@cockpit/shared';
import { CreatePriceListDto } from './dto/create-price-list.dto';
import { UpdatePriceListDto } from './dto/update-price-list.dto';
import { CreatePriceListEntryDto } from './dto/create-price-list-entry.dto';
import { UpdatePriceListEntryDto } from './dto/update-price-list-entry.dto';
import { ListPriceListsQueryDto } from './dto/list-price-lists-query.dto';
import { SetPriceListClientsDto } from './dto/set-price-list-clients.dto';
import { PriceListEntity } from './dto/price-list.entity';
import { PriceListEntryEntity } from './dto/price-list-entry.entity';
import { OkResponseEntity } from '../common/dto/ok-response.entity';
import type { Prisma } from '../../generated/prisma/client';

const INCLUDE = {
  entries: { include: { vehicleType: true }, orderBy: { createdAt: 'asc' as const } },
  clients: true,
};

// `.name` on a Client is derived (ClientsService.withName), never a real
// column — a Client row picked up through this module's own `include:
// { clients: true }` arrives without it, same reasoning as the identical
// helper in passengers.service.ts, and the same reason the "Clients" column
// on the Price Lists table read blank no matter how fresh the fetch was.
function withClientNames<
  T extends {
    clients: { ref: string; company: string | null; contactFirstName: string | null; contactLastName: string | null }[];
  },
>(priceList: T): T {
  return {
    ...priceList,
    clients: priceList.clients.map((c) => ({ ...c, name: clientDisplayName(c) })),
  };
}

@Injectable()
export class PriceListsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refCounter: RefCounterService,
  ) {}

  async list(query: ListPriceListsQueryDto): Promise<PriceListEntity[]> {
    const where: Prisma.PriceListWhereInput = {};
    if (query.clientRef) {
      where.clients = { some: { ref: query.clientRef } };
    }
    if (query.search?.trim()) {
      where.OR = [
        { name: { contains: query.search.trim(), mode: 'insensitive' } },
        { ref: { contains: query.search.trim(), mode: 'insensitive' } },
      ];
    }
    const priceLists = await this.prisma.priceList.findMany({
      where,
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return priceLists.map(withClientNames);
  }

  async findByRefOrThrow(ref: string) {
    const priceList = await this.prisma.priceList.findUnique({
      where: { ref },
      include: INCLUDE,
    });
    if (!priceList) throw new NotFoundException('Price list not found');
    return withClientNames(priceList);
  }

  get(ref: string): Promise<PriceListEntity> {
    return this.findByRefOrThrow(ref);
  }

  async create(dto: CreatePriceListDto): Promise<PriceListEntity> {
    const entriesData = dto.entries
      ? await Promise.all(dto.entries.map((e) => this.resolveEntryInput(e)))
      : undefined;

    const seq = await this.refCounter.next('priceList');
    const created = await this.prisma.priceList.create({
      data: {
        ref: `PL${seq}`,
        name: dto.name,
        active: dto.active ?? true,
        entries: entriesData ? { create: entriesData } : undefined,
      },
      include: INCLUDE,
    });
    return withClientNames(created);
  }

  async update(ref: string, dto: UpdatePriceListDto): Promise<PriceListEntity> {
    await this.findByRefOrThrow(ref);
    const updated = await this.prisma.priceList.update({
      where: { ref },
      data: { name: dto.name, active: dto.active },
      include: INCLUDE,
    });
    return withClientNames(updated);
  }

  async delete(ref: string): Promise<OkResponseEntity> {
    await this.findByRefOrThrow(ref);
    await this.prisma.priceList.delete({ where: { ref } });
    return { ok: true };
  }

  /** Replaces the full set of clients this list applies to. */
  async setClients(
    ref: string,
    dto: SetPriceListClientsDto,
  ): Promise<PriceListEntity> {
    await this.findByRefOrThrow(ref);
    if (dto.clientRefs.length > 0) {
      const found = await this.prisma.client.findMany({
        where: { ref: { in: dto.clientRefs } },
        select: { ref: true },
      });
      const missing = dto.clientRefs.filter(
        (r) => !found.some((f) => f.ref === r),
      );
      if (missing.length > 0) {
        throw new BadRequestException(
          `Client(s) not found: ${missing.join(', ')}`,
        );
      }
    }
    const updated = await this.prisma.priceList.update({
      where: { ref },
      data: { clients: { set: dto.clientRefs.map((r) => ({ ref: r })) } },
      include: INCLUDE,
    });
    return withClientNames(updated);
  }

  async addEntry(
    ref: string,
    dto: CreatePriceListEntryDto,
  ): Promise<PriceListEntryEntity> {
    const priceList = await this.findByRefOrThrow(ref);
    const data = await this.resolveEntryInput(dto);
    return this.prisma.priceListEntry.create({
      data: { ...data, priceListId: priceList.id },
      include: { vehicleType: true },
    });
  }

  async updateEntry(
    ref: string,
    entryId: string,
    dto: UpdatePriceListEntryDto,
  ): Promise<PriceListEntryEntity> {
    await this.findEntryOrThrow(ref, entryId);
    const data = await this.resolveEntryInput(dto, { partial: true });
    return this.prisma.priceListEntry.update({
      where: { id: entryId },
      data,
      include: { vehicleType: true },
    });
  }

  async deleteEntry(ref: string, entryId: string): Promise<OkResponseEntity> {
    await this.findEntryOrThrow(ref, entryId);
    await this.prisma.priceListEntry.delete({ where: { id: entryId } });
    return { ok: true };
  }

  private async findEntryOrThrow(ref: string, entryId: string) {
    const priceList = await this.findByRefOrThrow(ref);
    const entry = priceList.entries.find((e) => e.id === entryId);
    if (!entry)
      throw new NotFoundException('Entry not found on this price list');
    return entry;
  }

  /** Resolves `vehicleTypeRef` to `vehicleTypeId` and requires at least one
   * pickup descriptor (an address or an area) — a row with neither could
   * never actually match a trip. */
  private async resolveEntryInput(
    dto: CreatePriceListEntryDto | UpdatePriceListEntryDto,
    options?: { partial?: boolean },
  ): Promise<Omit<Prisma.PriceListEntryUncheckedCreateInput, 'priceListId'>> {
    let vehicleTypeId: string | null | undefined;
    if (dto.vehicleTypeRef !== undefined) {
      if (!dto.vehicleTypeRef) {
        vehicleTypeId = null;
      } else {
        const vehicleType = await this.prisma.vehicleType.findUnique({
          where: { ref: dto.vehicleTypeRef },
        });
        if (!vehicleType)
          throw new BadRequestException(
            `Vehicle type "${dto.vehicleTypeRef}" not found`,
          );
        vehicleTypeId = vehicleType.id;
      }
    }
    if (!options?.partial) {
      if (dto.priceEur === undefined) {
        throw new BadRequestException('priceEur is required');
      }
      if (!dto.pickupLocation && !dto.pickupPostalCodes?.length) {
        throw new BadRequestException(
          'Either pickupLocation or pickupPostalCodes is required',
        );
      }
    }
    return {
      pickupLocation: dto.pickupLocation,
      pickupPostalCodes: dto.pickupPostalCodes,
      pickupCountryCode: dto.pickupCountryCode,
      dropoffLocation: dto.dropoffLocation,
      dropoffPostalCodes: dto.dropoffPostalCodes,
      dropoffCountryCode: dto.dropoffCountryCode,
      bidirectional: dto.bidirectional,
      priceEur: dto.priceEur as number,
      ...(vehicleTypeId !== undefined ? { vehicleTypeId } : {}),
    };
  }
}
