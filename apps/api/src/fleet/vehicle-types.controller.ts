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
import { VehicleTypesService } from './vehicle-types.service';
import { CreateVehicleTypeDto } from './dto/create-vehicle-type.dto';
import { UpdateVehicleTypeDto } from './dto/update-vehicle-type.dto';
import { SetActiveDto } from '../common/dto/set-active.dto';

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

  @Put(':ref')
  update(@Param('ref') ref: string, @Body() dto: UpdateVehicleTypeDto) {
    return this.vehicleTypesService.update(ref, dto);
  }

  @Delete(':ref')
  delete(@Param('ref') ref: string) {
    return this.vehicleTypesService.delete(ref);
  }

  @Patch(':ref/active')
  setActive(@Param('ref') ref: string, @Body() dto: SetActiveDto) {
    return this.vehicleTypesService.setActive(ref, dto.active);
  }
}
