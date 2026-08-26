import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RefCounterService } from '../common/ref-counter/ref-counter.service';
import { CreateVehicleTypeDto } from './dto/create-vehicle-type.dto';

@Injectable()
export class VehicleTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refCounter: RefCounterService,
  ) {}

  async list() {
    const types = await this.prisma.vehicleType.findMany();
    types.sort((a, b) => a.ref.localeCompare(b.ref));
    return types;
  }

  async create(dto: CreateVehicleTypeDto) {
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
}
