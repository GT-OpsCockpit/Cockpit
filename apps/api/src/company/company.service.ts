import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanyInfoDto } from './dto/update-company-info.dto';

const SINGLETON_ID = 1;

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const info = await this.prisma.companyInfo.findUnique({
      where: { id: SINGLETON_ID },
    });
    return info ?? { id: SINGLETON_ID, saved: false };
  }

  // LEGACY_FEATURES.md §1: "companyInfoSaved (bool) verrouille l'édition
  // après la première sauvegarde" — a real server-side guard, not just a
  // frontend affordance, so PUT must reject once the singleton is saved.
  async update(dto: UpdateCompanyInfoDto) {
    const existing = await this.prisma.companyInfo.findUnique({
      where: { id: SINGLETON_ID },
    });
    if (existing?.saved) {
      throw new ConflictException(
        'Company info is locked after the first save and cannot be edited.',
      );
    }
    return this.prisma.companyInfo.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...dto, saved: true },
      update: { ...dto, saved: true },
    });
  }
}
