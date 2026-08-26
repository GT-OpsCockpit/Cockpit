import { Body, Controller, Get, Post } from '@nestjs/common';
import { VehicleTypesService } from './vehicle-types.service';
import { CreateVehicleTypeDto } from './dto/create-vehicle-type.dto';

@Controller('vehicles')
export class VehicleTypesController {
  constructor(private readonly vehicleTypesService: VehicleTypesService) {}

  @Get()
  list() {
    return this.vehicleTypesService.list();
  }

  @Post()
  create(@Body() dto: CreateVehicleTypeDto) {
    return this.vehicleTypesService.create(dto);
  }
}
