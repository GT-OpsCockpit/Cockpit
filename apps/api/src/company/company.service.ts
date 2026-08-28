import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanyInfoDto } from './dto/update-company-info.dto';
import { normalizePhone } from '../common/utils/normalize-phone';
import { CompanyInfoEntity } from './dto/company-info.entity';

const SINGLETON_ID = 1;

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<CompanyInfoEntity> {
    const info = await this.prisma.companyInfo.findUnique({
      where: { id: SINGLETON_ID },
    });
    return info ?? { id: SINGLETON_ID, saved: false };
  }

  // `saved` records that the sheet has been filled in at least once — it is
  // NOT a permanent lock. The legacy read it exactly that way: once saved,
  // the fields went read-only in the UI, and the pencil re-opened them for
  // editing behind the Owner password, as many times as needed
  // (owner.html:269-280). Rejecting a second PUT here would make the
  // company sheet uncorrectable forever; the `company:edit` permission on
  // the controller is what plays the Owner-password gate's role now.
  update(dto: UpdateCompanyInfoDto): Promise<CompanyInfoEntity> {
    // The DTO is spread wholesale, so `mobile` used to reach the column exactly
    // as typed — the one phone in the app that skipped normalization entirely.
    const data = { ...dto, mobile: normalizePhone(dto.mobile) };
    return this.prisma.companyInfo.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...data, saved: true },
      update: { ...data, saved: true },
    });
  }
}
