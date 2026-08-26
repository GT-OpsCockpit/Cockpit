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
import { VehicleTypeEntity } from './dto/vehicle-type.entity';
import { OkResponseEntity } from '../common/dto/ok-response.entity';

@Controller('vehicles')
export class VehicleTypesController {
  constructor(private readonly vehicleTypesService: VehicleTypesService) {}

  @Get()
  list(): Promise<VehicleTypeEntity[]> {
    return this.vehicleTypesService.list();
  }

  @Post()
  create(@Body() dto: CreateVehicleTypeDto): Promise<VehicleTypeEntity> {
    return this.vehicleTypesService.create(dto);
  }

  @Put(':ref')
  update(
    @Param('ref') ref: string,
    @Body() dto: UpdateVehicleTypeDto,
  ): Promise<VehicleTypeEntity> {
    return this.vehicleTypesService.update(ref, dto);
  }

  @Delete(':ref')
  delete(@Param('ref') ref: string): Promise<OkResponseEntity> {
    return this.vehicleTypesService.delete(ref);
  }

  @Patch(':ref/active')
  setActive(
    @Param('ref') ref: string,
    @Body() dto: SetActiveDto,
  ): Promise<VehicleTypeEntity> {
    return this.vehicleTypesService.setActive(ref, dto.active);
  }
}
