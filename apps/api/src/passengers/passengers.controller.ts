import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { PassengersService } from './passengers.service';
import { CreatePassengerDto } from './dto/create-passenger.dto';
import { UpdatePassengerDto } from './dto/update-passenger.dto';
import { CreatePassengerRouteDto } from './dto/create-passenger-route.dto';
import { UpdatePassengerRouteDto } from './dto/update-passenger-route.dto';
import { CreatePassengerAddressDto } from './dto/create-passenger-address.dto';
import { UpdatePassengerAddressDto } from './dto/update-passenger-address.dto';
import { PassengerAddressEntity } from './dto/passenger-address.entity';
import { ListPassengersQueryDto } from './dto/list-passengers-query.dto';
import { PassengerEntity } from './dto/passenger.entity';
import { PassengerRouteEntity } from './dto/passenger-route.entity';
import { OkResponseEntity } from '../common/dto/ok-response.entity';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@Controller('passengers')
export class PassengersController {
  constructor(private readonly passengers: PassengersService) {}

  @Get()
  list(@Query() query: ListPassengersQueryDto): Promise<PassengerEntity[]> {
    return this.passengers.list(query);
  }

  @Get(':ref')
  get(@Param('ref') ref: string): Promise<PassengerEntity> {
    return this.passengers.get(ref);
  }

  @Post()
  create(@Body() dto: CreatePassengerDto): Promise<PassengerEntity> {
    return this.passengers.create(dto);
  }

  @Put(':ref')
  update(
    @Param('ref') ref: string,
    @Body() dto: UpdatePassengerDto,
  ): Promise<PassengerEntity> {
    return this.passengers.update(ref, dto);
  }

  // Permanent, unrecoverable — same Manager-password gate as every other
  // hard delete in the app (docs/agents/permissions.md).
  @RequirePermission('record:delete')
  @Delete(':ref')
  delete(@Param('ref') ref: string): Promise<OkResponseEntity> {
    return this.passengers.delete(ref);
  }

  @Post(':ref/routes')
  addRoute(
    @Param('ref') ref: string,
    @Body() dto: CreatePassengerRouteDto,
  ): Promise<PassengerRouteEntity> {
    return this.passengers.addRoute(ref, dto);
  }

  @Put(':ref/routes/:routeId')
  updateRoute(
    @Param('ref') ref: string,
    @Param('routeId') routeId: string,
    @Body() dto: UpdatePassengerRouteDto,
  ): Promise<PassengerRouteEntity> {
    return this.passengers.updateRoute(ref, routeId, dto);
  }

  @RequirePermission('record:delete')
  @Delete(':ref/routes/:routeId')
  deleteRoute(
    @Param('ref') ref: string,
    @Param('routeId') routeId: string,
  ): Promise<OkResponseEntity> {
    return this.passengers.deleteRoute(ref, routeId);
  }

  @Post(':ref/addresses')
  addAddress(
    @Param('ref') ref: string,
    @Body() dto: CreatePassengerAddressDto,
  ): Promise<PassengerAddressEntity> {
    return this.passengers.addAddress(ref, dto);
  }

  @Put(':ref/addresses/:addressId')
  updateAddress(
    @Param('ref') ref: string,
    @Param('addressId') addressId: string,
    @Body() dto: UpdatePassengerAddressDto,
  ): Promise<PassengerAddressEntity> {
    return this.passengers.updateAddress(ref, addressId, dto);
  }

  @RequirePermission('record:delete')
  @Delete(':ref/addresses/:addressId')
  deleteAddress(
    @Param('ref') ref: string,
    @Param('addressId') addressId: string,
  ): Promise<OkResponseEntity> {
    return this.passengers.deleteAddress(ref, addressId);
  }
}
