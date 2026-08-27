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
import { FleetVehiclesService } from './fleet-vehicles.service';
import { CreateFleetVehicleDto } from './dto/create-fleet-vehicle.dto';
import { SetFleetUnavailabilityDto } from './dto/set-fleet-unavailability.dto';
import { SetFleetDriverDto } from './dto/set-fleet-driver.dto';
import { ListFleetVehiclesQueryDto } from './dto/list-fleet-vehicles-query.dto';
import { SetActiveDto } from '../common/dto/set-active.dto';
import { FleetVehicleEntity } from './dto/fleet-vehicle.entity';
import { FleetVehicleListEntity } from './dto/fleet-vehicle-list.entity';
import { OkResponseEntity } from '../common/dto/ok-response.entity';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/guards/session-auth.guard';

@Controller('fleet-vehicles')
export class FleetVehiclesController {
  constructor(private readonly fleetVehiclesService: FleetVehiclesService) {}

  @Get()
  list(@Query() query: ListFleetVehiclesQueryDto): Promise<FleetVehicleListEntity> {
    return this.fleetVehiclesService.list(query);
  }

  @Post()
  create(@Body() dto: CreateFleetVehicleDto): Promise<FleetVehicleEntity> {
    return this.fleetVehiclesService.create(dto);
  }

  @Put(':ref')
  update(
    @Param('ref') ref: string,
    @Body() dto: CreateFleetVehicleDto,
  ): Promise<FleetVehicleEntity> {
    return this.fleetVehiclesService.update(ref, dto);
  }

  @Delete(':ref')
  delete(@Param('ref') ref: string): Promise<OkResponseEntity> {
    return this.fleetVehiclesService.delete(ref);
  }

  // Deactivation is ungated (matches DriversController.setActive); only the
  // false→true reactivation transition needs vehicle:reactivate, checked
  // inside the service since it depends on the vehicle's current state. See
  // docs/agents/permissions.md.
  @Patch(':ref/active')
  setActive(
    @Param('ref') ref: string,
    @Body() dto: SetActiveDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FleetVehicleEntity> {
    return this.fleetVehiclesService.setActive(ref, dto.active, user);
  }

  @Patch(':ref/driver')
  setDriver(
    @Param('ref') ref: string,
    @Body() dto: SetFleetDriverDto,
  ): Promise<FleetVehicleEntity> {
    return this.fleetVehiclesService.setDriver(ref, dto.driverRef);
  }

  // Nullable in practice only if the vehicle was deleted between the
  // existence check and the read-back inside the service (a vanishingly
  // rare race) — documented as always-present since that's the real shape.
  @ApiOkResponse({ type: FleetVehicleEntity })
  @Patch(':ref/unavailability')
  setUnavailability(
    @Param('ref') ref: string,
    @Body() dto: SetFleetUnavailabilityDto,
  ): Promise<FleetVehicleEntity | null> {
    return this.fleetVehiclesService.setUnavailability(ref, dto);
  }
}
