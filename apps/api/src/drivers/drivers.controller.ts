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
import { ApiOkResponse } from '@nestjs/swagger';
import { DriversService } from './drivers.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { SetDriverUnavailabilityDto } from './dto/set-unavailability.dto';
import { ListDriversQueryDto } from './dto/list-drivers-query.dto';
import { SetActiveDto } from '../common/dto/set-active.dto';
import {
  DriverEntity,
  DriverWithUnavailabilityEntity,
} from './dto/driver.entity';
import { DriverListEntity } from './dto/driver-list.entity';
import { OkResponseEntity } from '../common/dto/ok-response.entity';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/guards/session-auth.guard';

@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get()
  list(@Query() query: ListDriversQueryDto): Promise<DriverListEntity> {
    return this.driversService.list(query);
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

  // Deactivation is ungated (matches ClientsController.setActive); only the
  // false→true reactivation transition needs driver:reactivate, checked
  // inside the service since it depends on the driver's current state — same
  // shape as TripsService.update's conditional trip:edit-past/trip:edit-price
  // checks. See docs/agents/permissions.md.
  @Patch(':ref/active')
  setActive(
    @Param('ref') ref: string,
    @Body() dto: SetActiveDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DriverEntity> {
    return this.driversService.setActive(ref, dto.active, user);
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
