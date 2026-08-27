import { Body, Controller, Get, Put } from '@nestjs/common';
import { CompanyService } from './company.service';
import { UpdateCompanyInfoDto } from './dto/update-company-info.dto';
import { CompanyInfoEntity } from './dto/company-info.entity';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

// The legacy gated this behind a second "Owner password"; here that's
// replaced by requiring the `company:edit` permission (ADMIN today — see
// docs/agents/permissions.md).
@Controller('company-info')
@RequirePermission('company:edit')
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
