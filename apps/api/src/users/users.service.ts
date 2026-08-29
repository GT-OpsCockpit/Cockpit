import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { normalizeEmail } from '@cockpit/shared';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePhone } from '../common/utils/normalize-phone';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PublicUserEntity } from './dto/user.entity';

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

  list(): Promise<PublicUserEntity[]> {
    // Active accounts first, then deactivated ones at the bottom — same
    // convention as clients/drivers/fleet (see docs/LEGACY_FEATURES.md §3).
    return this.prisma.user.findMany({
      select: PUBLIC_SELECT,
      orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async create(dto: CreateUserDto): Promise<PublicUserEntity> {
    // Stored normalized so login stays case-insensitive (see LoginDto) and
    // the unique index can't be defeated by a different capitalization.
    const email = normalizeEmail(dto.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await argon2.hash(dto.password);
    return this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role: dto.role,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: normalizePhone(dto.phone),
      },
      select: PUBLIC_SELECT,
    });
  }

  async update(id: string, dto: UpdateUserDto): Promise<PublicUserEntity> {
    await this.findOrThrow(id);
    const email = dto.email ? normalizeEmail(dto.email) : undefined;
    if (email) {
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== id) {
        throw new ConflictException('Email already in use');
      }
    }
    return this.prisma.user.update({
      where: { id },
      data: {
        email,
        role: dto.role,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: normalizePhone(dto.phone),
      },
      select: PUBLIC_SELECT,
    });
  }

  /**
   * Replaces an account's password. Every session it already has stays valid:
   * this exists to get a locked-out account back in, not to evict one — and
   * deactivate() is the endpoint for the latter.
   */
  async setPassword(id: string, password: string): Promise<PublicUserEntity> {
    await this.findOrThrow(id);
    return this.prisma.user.update({
      where: { id },
      data: { passwordHash: await argon2.hash(password) },
      select: PUBLIC_SELECT,
    });
  }

  // Deactivation is one-way, matching the legacy access accounts: no
  // reactivation endpoint exists (asymmetric compared to clients/drivers/fleet).
  async deactivate(id: string): Promise<PublicUserEntity> {
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
