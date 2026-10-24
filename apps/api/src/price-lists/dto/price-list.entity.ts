import { ClientEntity } from '../../clients/dto/client.entity';
import { PriceListEntryEntity } from './price-list-entry.entity';

export class PriceListEntity {
  id: string;
  ref: string;
  name: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  entries: PriceListEntryEntity[];
  /** Every client this list currently applies to. */
  clients: ClientEntity[];
}
