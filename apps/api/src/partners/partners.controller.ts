import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { PartnersService } from './partners.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { PartnerEntity } from './dto/partner.entity';
import { ListPartnersQueryDto } from './dto/list-partners-query.dto';
import { SetActiveDto } from '../common/dto/set-active.dto';
import { OkResponseEntity } from '../common/dto/ok-response.entity';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@Controller('partners')
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Get()
  list(@Query() query: ListPartnersQueryDto): Promise<PartnerEntity[]> {
    return this.partnersService.list(query.includeInactive, query.category);
  }

  @Post()
  create(@Body() dto: CreatePartnerDto): Promise<PartnerEntity> {
    return this.partnersService.create(dto);
  }

  @Put(':ref')
  update(
    @Param('ref') ref: string,
    @Body() dto: UpdatePartnerDto,
  ): Promise<PartnerEntity> {
    return this.partnersService.update(ref, dto);
  }

  @Patch(':ref/active')
  setActive(
    @Param('ref') ref: string,
    @Body() dto: SetActiveDto,
  ): Promise<PartnerEntity> {
    return this.partnersService.setActive(ref, dto.active);
  }

  // Permanent, unrecoverable — same rule as every other hard-delete in the
  // app (see VehicleTypesController, docs/agents/permissions.md).
  @RequirePermission('record:delete')
  @Delete(':ref')
  delete(@Param('ref') ref: string): Promise<OkResponseEntity> {
    return this.partnersService.delete(ref);
  }
}
