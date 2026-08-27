import { DriverEntity } from './driver.entity';

/** Paginated envelope for GET /drivers — filtering/pagination happen server-side, see DriversService.list(). */
export class DriverListEntity {
  data: DriverEntity[];
  total: number;
  page: number;
  limit: number;
}
