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
import { FleetVehiclesService } from './fleet-vehicles.service';
import { CreateFleetVehicleDto } from './dto/create-fleet-vehicle.dto';
import { SetFleetUnavailabilityDto } from './dto/set-fleet-unavailability.dto';
import { SetFleetDriverDto } from './dto/set-fleet-driver.dto';
import { SetActiveDto } from '../common/dto/set-active.dto';

@Controller('fleet-vehicles')
export class FleetVehiclesController {
  constructor(private readonly fleetVehiclesService: FleetVehiclesService) {}

  @Get()
  list() {
    return this.fleetVehiclesService.list();
  }

  @Post()
  create(@Body() dto: CreateFleetVehicleDto) {
    return this.fleetVehiclesService.create(dto);
  }

  @Put(':ref')
  update(@Param('ref') ref: string, @Body() dto: CreateFleetVehicleDto) {
    return this.fleetVehiclesService.update(ref, dto);
  }

  @Delete(':ref')
  delete(@Param('ref') ref: string) {
    return this.fleetVehiclesService.delete(ref);
  }

  @Patch(':ref/active')
  setActive(@Param('ref') ref: string, @Body() dto: SetActiveDto) {
    return this.fleetVehiclesService.setActive(ref, dto.active);
  }

  @Patch(':ref/driver')
  setDriver(@Param('ref') ref: string, @Body() dto: SetFleetDriverDto) {
    return this.fleetVehiclesService.setDriver(ref, dto.driverRef);
  }

  @Patch(':ref/unavailability')
  setUnavailability(
    @Param('ref') ref: string,
    @Body() dto: SetFleetUnavailabilityDto,
  ) {
    return this.fleetVehiclesService.setUnavailability(ref, dto);
  }
}
