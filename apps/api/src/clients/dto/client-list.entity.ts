import { ClientEntity } from './client.entity';

/** Paginated envelope for GET /clients — filtering/pagination happen server-side, see ClientsService.list(). */
export class ClientListEntity {
  data: ClientEntity[];
  total: number;
  page: number;
  limit: number;
}
