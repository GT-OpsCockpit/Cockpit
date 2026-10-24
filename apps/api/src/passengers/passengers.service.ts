import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RefCounterService } from '../common/ref-counter/ref-counter.service';
import { clientDisplayName } from '@cockpit/shared';
import { CreatePassengerDto } from './dto/create-passenger.dto';
import { UpdatePassengerDto } from './dto/update-passenger.dto';
import { CreatePassengerRouteDto } from './dto/create-passenger-route.dto';
import { UpdatePassengerRouteDto } from './dto/update-passenger-route.dto';
import { CreatePassengerAddressDto } from './dto/create-passenger-address.dto';
import { UpdatePassengerAddressDto } from './dto/update-passenger-address.dto';
import { PassengerAddressEntity } from './dto/passenger-address.entity';
import { ListPassengersQueryDto } from './dto/list-passengers-query.dto';
import { PassengerEntity } from './dto/passenger.entity';
import { PassengerRouteEntity } from './dto/passenger-route.entity';
import { OkResponseEntity } from '../common/dto/ok-response.entity';
import type { Passenger, Prisma } from '../../generated/prisma/client';

const INCLUDE = {
  client: true,
  routes: { include: { vehicleType: true }, orderBy: { createdAt: 'asc' as const } },
  addresses: { orderBy: { createdAt: 'asc' as const } },
};

// No fallback to a ref, unlike clientDisplayName: a passenger is always a
// person (never a company standing in for one, the way a farmed-out
// driver's Company field can), so first+last is the whole story — same
// reasoning as driverDisplayName in @cockpit/shared.
//
// `client` also needs its own `.name` added here: it's a derived value
// (ClientsService.withName), never a real column, so a Client row picked up
// through this module's own `include: { client: true }` arrives without it
// — the exact reason the customer column of the Passengers table read blank
// regardless of how fresh the fetch was.
function withName<
  T extends Pick<Passenger, 'firstName' | 'lastName'> & {
    client: { ref: string; company: string | null; contactFirstName: string | null; contactLastName: string | null } | null;
  },
>(
  passenger: T,
): Omit<T, 'client'> & {
  name: string;
  client: T['client'] extends infer C ? (C extends null ? null : C & { name: string }) : never;
} {
  const name = [passenger.firstName, passenger.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  return {
    ...passenger,
    name,
    ...(passenger.client ? { client: { ...passenger.client, name: clientDisplayName(passenger.client) } } : {}),
    // TypeScript cannot prove the conditional `client` type from the spread above.
  } as unknown as ReturnType<typeof withName<T>>;
}

@Injectable()
export class PassengersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refCounter: RefCounterService,
  ) {}

  async list(query: ListPassengersQueryDto): Promise<PassengerEntity[]> {
    const where: Prisma.PassengerWhereInput = {};
    if (query.clientRef) {
      where.client = { ref: query.clientRef };
    }
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { ref: { contains: term, mode: 'insensitive' } },
      ];
    }
    const passengers = await this.prisma.passenger.findMany({
      where,
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return passengers.map(withName);
  }

  async findByRefOrThrow(ref: string) {
    const passenger = await this.prisma.passenger.findUnique({
      where: { ref },
      include: INCLUDE,
    });
    if (!passenger) throw new NotFoundException('Passenger not found');
    return passenger;
  }

  async get(ref: string): Promise<PassengerEntity> {
    return withName(await this.findByRefOrThrow(ref));
  }

  async create(dto: CreatePassengerDto): Promise<PassengerEntity> {
    let clientId: string | undefined;
    if (dto.clientRef) {
      const client = await this.prisma.client.findUnique({
        where: { ref: dto.clientRef },
      });
      if (!client)
        throw new BadRequestException(`Client "${dto.clientRef}" not found`);
      clientId = client.id;
    }

    const routesData = dto.routes
      ? await Promise.all(dto.routes.map((r) => this.resolveRouteInput(r)))
      : undefined;

    const seq = await this.refCounter.next('passenger');
    const created = await this.prisma.passenger.create({
      data: {
        ref: `PSG${seq}`,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        email: dto.email,
        notes: dto.notes,
        clientId,
        routes: routesData ? { create: routesData } : undefined,
      },
      include: INCLUDE,
    });
    return withName(created);
  }

  async update(ref: string, dto: UpdatePassengerDto): Promise<PassengerEntity> {
    await this.findByRefOrThrow(ref);

    let clientId: string | null | undefined;
    if (dto.clientRef !== undefined) {
      if (dto.clientRef === null || dto.clientRef === '') {
        clientId = null;
      } else {
        const client = await this.prisma.client.findUnique({
          where: { ref: dto.clientRef },
        });
        if (!client)
          throw new BadRequestException(
            `Client "${dto.clientRef}" not found`,
          );
        clientId = client.id;
      }
    }

    const updated = await this.prisma.passenger.update({
      where: { ref },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        email: dto.email,
        notes: dto.notes,
        ...(clientId !== undefined ? { clientId } : {}),
      },
      include: INCLUDE,
    });
    return withName(updated);
  }

  async delete(ref: string): Promise<OkResponseEntity> {
    await this.findByRefOrThrow(ref);
    await this.prisma.passenger.delete({ where: { ref } });
    return { ok: true };
  }

  async addRoute(
    ref: string,
    dto: CreatePassengerRouteDto,
  ): Promise<PassengerRouteEntity> {
    const passenger = await this.findByRefOrThrow(ref);
    const data = await this.resolveRouteInput(dto);
    return this.prisma.passengerRoute.create({
      data: { ...data, passengerId: passenger.id },
      include: { vehicleType: true },
    });
  }

  async updateRoute(
    ref: string,
    routeId: string,
    dto: UpdatePassengerRouteDto,
  ): Promise<PassengerRouteEntity> {
    await this.findRouteOrThrow(ref, routeId);
    const data = await this.resolveRouteInput(dto, { partial: true });
    return this.prisma.passengerRoute.update({
      where: { id: routeId },
      data,
      include: { vehicleType: true },
    });
  }

  async deleteRoute(ref: string, routeId: string): Promise<OkResponseEntity> {
    await this.findRouteOrThrow(ref, routeId);
    await this.prisma.passengerRoute.delete({ where: { id: routeId } });
    return { ok: true };
  }

  async addAddress(
    ref: string,
    dto: CreatePassengerAddressDto,
  ): Promise<PassengerAddressEntity> {
    const passenger = await this.findByRefOrThrow(ref);
    return this.prisma.passengerAddress.create({
      data: {
        passengerId: passenger.id,
        title: dto.title,
        address: dto.address,
        info: dto.info,
        countryCode: dto.countryCode,
        postalCode: dto.postalCode,
        area: dto.area,
        isAirport: dto.isAirport ?? false,
      },
    });
  }

  async updateAddress(
    ref: string,
    addressId: string,
    dto: UpdatePassengerAddressDto,
  ): Promise<PassengerAddressEntity> {
    await this.findAddressOrThrow(ref, addressId);
    return this.prisma.passengerAddress.update({
      where: { id: addressId },
      data: {
        title: dto.title,
        address: dto.address,
        info: dto.info,
        countryCode: dto.countryCode,
        postalCode: dto.postalCode,
        area: dto.area,
        isAirport: dto.isAirport,
      },
    });
  }

  async deleteAddress(ref: string, addressId: string): Promise<OkResponseEntity> {
    await this.findAddressOrThrow(ref, addressId);
    await this.prisma.passengerAddress.delete({ where: { id: addressId } });
    return { ok: true };
  }

  private async findAddressOrThrow(ref: string, addressId: string) {
    const passenger = await this.findByRefOrThrow(ref);
    const address = passenger.addresses.find((a) => a.id === addressId);
    if (!address)
      throw new NotFoundException('Address not found on this passenger');
    return address;
  }

  private async findRouteOrThrow(ref: string, routeId: string) {
    const passenger = await this.findByRefOrThrow(ref);
    const route = passenger.routes.find((r) => r.id === routeId);
    if (!route) throw new NotFoundException('Route not found on this passenger');
    return route;
  }

  /** Resolves `vehicleTypeRef` to `vehicleTypeId` — same ref-in/id-stored
   * convention as everywhere else — and passes the rest through unchanged. */
  private async resolveRouteInput(
    dto: CreatePassengerRouteDto | UpdatePassengerRouteDto,
    options?: { partial?: boolean },
  ): Promise<Omit<Prisma.PassengerRouteUncheckedCreateInput, 'passengerId'>> {
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
    if (!options?.partial && dto.pickupLocation === undefined) {
      throw new BadRequestException('pickupLocation is required');
    }
    if (!options?.partial && dto.priceEur === undefined) {
      throw new BadRequestException('priceEur is required');
    }
    return {
      pickupLocation: dto.pickupLocation as string,
      dropoffLocation: dto.dropoffLocation,
      priceEur: dto.priceEur as number,
      ...(vehicleTypeId !== undefined ? { vehicleTypeId } : {}),
    };
  }
}
