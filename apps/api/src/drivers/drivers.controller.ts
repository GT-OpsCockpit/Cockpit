import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { DriversService } from './drivers.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { SetDriverUnavailabilityDto } from './dto/set-unavailability.dto';
import { SetActiveDto } from '../common/dto/set-active.dto';
import {
  DriverEntity,
  DriverWithUnavailabilityEntity,
} from './dto/driver.entity';
import { OkResponseEntity } from '../common/dto/ok-response.entity';

@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get()
  list(): Promise<DriverEntity[]> {
    return this.driversService.list();
  }

  @Post()
  create(@Body() dto: CreateDriverDto): Promise<DriverEntity> {
    return this.driversService.create(dto);
  }

  @Put(':ref')
  update(
    @Param('ref') ref: string,
    @Body() dto: CreateDriverDto,
  ): Promise<DriverEntity> {
    return this.driversService.update(ref, dto);
  }

  @Delete(':ref')
  delete(@Param('ref') ref: string): Promise<OkResponseEntity> {
    return this.driversService.delete(ref);
  }

  @Patch(':ref/active')
  setActive(
    @Param('ref') ref: string,
    @Body() dto: SetActiveDto,
  ): Promise<DriverEntity> {
    return this.driversService.setActive(ref, dto.active);
  }

  // Nullable in practice only if the driver was deleted between the
  // existence check and the read-back inside the service (a vanishingly
  // rare race) — documented as always-present since that's the real shape.
  @ApiOkResponse({ type: DriverWithUnavailabilityEntity })
  @Patch(':ref/unavailability')
  setUnavailability(
    @Param('ref') ref: string,
    @Body() dto: SetDriverUnavailabilityDto,
  ): Promise<DriverWithUnavailabilityEntity | null> {
    return this.driversService.setUnavailability(ref, dto);
  }
}
