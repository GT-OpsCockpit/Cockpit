import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const PUBLIC_SELECT = {
  id: true,
  email: true,
  role: true,
  firstName: true,
  lastName: true,
  phone: true,
  active: true,
  deactivatedAt: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    // Active accounts first, then deactivated ones at the bottom — same
    // convention as clients/drivers/fleet (see docs/LEGACY_FEATURES.md §3).
    return this.prisma.user.findMany({
      select: PUBLIC_SELECT,
      orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await argon2.hash(dto.password);
    return this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role: dto.role,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
      },
      select: PUBLIC_SELECT,
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOrThrow(id);
    if (dto.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('Email already in use');
      }
    }
    return this.prisma.user.update({
      where: { id },
      data: {
        email: dto.email,
        role: dto.role,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
      },
      select: PUBLIC_SELECT,
    });
  }

  // Deactivation is one-way, matching the legacy access accounts: no
  // reactivation endpoint exists (asymmetric compared to clients/drivers/fleet).
  async deactivate(id: string) {
    await this.findOrThrow(id);
    return this.prisma.user.update({
      where: { id },
      data: { active: false, deactivatedAt: new Date() },
      select: PUBLIC_SELECT,
    });
  }

  private async findOrThrow(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
