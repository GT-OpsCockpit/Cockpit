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
import { Transform } from 'class-transformer';
import { IsOptional, IsBoolean, IsString } from 'class-validator';
import { PartnersService } from './partners.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { PartnerEntity } from './dto/partner.entity';
import { SetActiveDto } from '../common/dto/set-active.dto';
import { OkResponseEntity } from '../common/dto/ok-response.entity';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

class ListPartnersQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeInactive?: boolean;

  /** Drivers & Partners page "Vehicle category" filter — matches a partner whose own roster includes a vehicle of this Category name. */
  @IsOptional()
  @IsString()
  category?: string;
}

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
