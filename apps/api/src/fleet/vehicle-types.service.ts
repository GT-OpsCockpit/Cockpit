import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RefCounterService } from '../common/ref-counter/ref-counter.service';
import { CreateVehicleTypeDto } from './dto/create-vehicle-type.dto';
import { UpdateVehicleTypeDto } from './dto/update-vehicle-type.dto';
import { VehicleTypeEntity } from './dto/vehicle-type.entity';
import { OkResponseEntity } from '../common/dto/ok-response.entity';

@Injectable()
export class VehicleTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refCounter: RefCounterService,
  ) {}

  async list(): Promise<VehicleTypeEntity[]> {
    const types = await this.prisma.vehicleType.findMany();
    types.sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.ref.localeCompare(b.ref);
    });
    return types;
  }

  async create(dto: CreateVehicleTypeDto): Promise<VehicleTypeEntity> {
    const existing = await this.prisma.vehicleType.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException(
        `A vehicle named "${dto.name}" already exists`,
      );
    }
    const seq = await this.refCounter.next('vehicleType');
    return this.prisma.vehicleType.create({
      data: { ref: `V${seq}`, name: dto.name, maxPax: dto.maxPax },
    });
  }

  async update(
    ref: string,
    dto: UpdateVehicleTypeDto,
  ): Promise<VehicleTypeEntity> {
    await this.findByRefOrThrow(ref);
    if (dto.name !== undefined) {
      const conflict = await this.prisma.vehicleType.findUnique({
        where: { name: dto.name },
      });
      if (conflict && conflict.ref !== ref) {
        throw new ConflictException(
          `A vehicle named "${dto.name}" already exists`,
        );
      }
    }
    return this.prisma.vehicleType.update({
      where: { ref },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.maxPax !== undefined && { maxPax: dto.maxPax }),
      },
    });
  }

  async delete(ref: string): Promise<OkResponseEntity> {
    const type = await this.findByRefOrThrow(ref);
    const [fleetCount, tripCount] = await Promise.all([
      this.prisma.fleetVehicle.count({ where: { categoryId: type.id } }),
      this.prisma.trip.count({ where: { vehicleTypeId: type.id } }),
    ]);
    if (fleetCount > 0 || tripCount > 0) {
      throw new BadRequestException(
        'This vehicle type is in use by fleet vehicles or trips and cannot be deleted — deactivate it instead.',
      );
    }
    await this.prisma.vehicleType.delete({ where: { ref } });
    return { ok: true };
  }

  async setActive(ref: string, active: boolean): Promise<VehicleTypeEntity> {
    await this.findByRefOrThrow(ref);
    return this.prisma.vehicleType.update({
      where: { ref },
      data: { active },
    });
  }

  private async findByRefOrThrow(ref: string) {
    const type = await this.prisma.vehicleType.findUnique({ where: { ref } });
    if (!type) throw new NotFoundException('Vehicle type not found');
    return type;
  }
}
