import { Injectable } from '@nestjs/common';
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

  // No server-side lock once saved=true: like the legacy, the "locked after
  // first save" behavior is a frontend affordance only — PUT always accepts
  // a full, valid payload and overwrites (see docs/LEGACY_FEATURES.md §1).
  async update(dto: UpdateCompanyInfoDto) {
    return this.prisma.companyInfo.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...dto, saved: true },
      update: { ...dto, saved: true },
    });
  }
}
