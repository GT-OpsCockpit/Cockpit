import { Module } from '@nestjs/common';
import { VehicleTypesController } from './vehicle-types.controller';
import { VehicleTypesService } from './vehicle-types.service';
import { FleetVehiclesController } from './fleet-vehicles.controller';
import { FleetVehiclesService } from './fleet-vehicles.service';
import { PartnersModule } from '../partners/partners.module';

@Module({
  imports: [PartnersModule],
  controllers: [VehicleTypesController, FleetVehiclesController],
  providers: [VehicleTypesService, FleetVehiclesService],
  exports: [VehicleTypesService, FleetVehiclesService],
})
export class FleetModule {}
