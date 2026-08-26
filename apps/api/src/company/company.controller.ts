import { Body, Controller, Get, Put } from '@nestjs/common';
import { CompanyService } from './company.service';
import { UpdateCompanyInfoDto } from './dto/update-company-info.dto';
import { CompanyInfoEntity } from './dto/company-info.entity';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../../generated/prisma/enums';

// The legacy gated this behind a second "Owner password"; here that's
// replaced by requiring the ADMIN role (see docs/BACKEND_PLAN.md).
@Controller('company-info')
@Roles(Role.ADMIN)
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get()
  get(): Promise<CompanyInfoEntity> {
    return this.companyService.get();
  }

  @Put()
  update(@Body() dto: UpdateCompanyInfoDto): Promise<CompanyInfoEntity> {
    return this.companyService.update(dto);
  }
}
