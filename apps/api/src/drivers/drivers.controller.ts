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
import { DriversService } from './drivers.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { SetDriverUnavailabilityDto } from './dto/set-unavailability.dto';
import { SetActiveDto } from '../common/dto/set-active.dto';

@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get()
  list() {
    return this.driversService.list();
  }

  @Post()
  create(@Body() dto: CreateDriverDto) {
    return this.driversService.create(dto);
  }

  @Put(':ref')
  update(@Param('ref') ref: string, @Body() dto: CreateDriverDto) {
    return this.driversService.update(ref, dto);
  }

  @Delete(':ref')
  delete(@Param('ref') ref: string) {
    return this.driversService.delete(ref);
  }

  @Patch(':ref/active')
  setActive(@Param('ref') ref: string, @Body() dto: SetActiveDto) {
    return this.driversService.setActive(ref, dto.active);
  }

  @Patch(':ref/unavailability')
  setUnavailability(
    @Param('ref') ref: string,
    @Body() dto: SetDriverUnavailabilityDto,
  ) {
    return this.driversService.setUnavailability(ref, dto);
  }
}
