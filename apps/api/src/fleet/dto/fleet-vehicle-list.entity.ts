import { FleetVehicleEntity } from './fleet-vehicle.entity';

/** Paginated envelope for GET /fleet-vehicles — filtering/pagination happen server-side, see FleetVehiclesService.list(). */
export class FleetVehicleListEntity {
  data: FleetVehicleEntity[];
  total: number;
  page: number;
  limit: number;
}
