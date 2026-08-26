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
import { FleetVehiclesService } from './fleet-vehicles.service';
import { CreateFleetVehicleDto } from './dto/create-fleet-vehicle.dto';
import { SetFleetUnavailabilityDto } from './dto/set-fleet-unavailability.dto';
import { SetFleetDriverDto } from './dto/set-fleet-driver.dto';
import { SetActiveDto } from '../common/dto/set-active.dto';
import { FleetVehicleEntity } from './dto/fleet-vehicle.entity';
import { OkResponseEntity } from '../common/dto/ok-response.entity';

@Controller('fleet-vehicles')
export class FleetVehiclesController {
  constructor(private readonly fleetVehiclesService: FleetVehiclesService) {}

  @Get()
  list(): Promise<FleetVehicleEntity[]> {
    return this.fleetVehiclesService.list();
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

  @Patch(':ref/active')
  setActive(
    @Param('ref') ref: string,
    @Body() dto: SetActiveDto,
  ): Promise<FleetVehicleEntity> {
    return this.fleetVehiclesService.setActive(ref, dto.active);
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
