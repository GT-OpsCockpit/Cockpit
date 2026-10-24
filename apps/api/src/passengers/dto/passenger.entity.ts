import { ClientEntity } from '../../clients/dto/client.entity';
import { PassengerRouteEntity } from './passenger-route.entity';
import { PassengerAddressEntity } from './passenger-address.entity';

export class PassengerBaseEntity {
  id: string;
  ref: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  clientId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** A Passenger, plus the derived display `name` (passengerDisplayName), its routes and saved addresses. */
export class PassengerEntity extends PassengerBaseEntity {
  name: string;
  client: ClientEntity | null;
  routes: PassengerRouteEntity[];
  addresses: PassengerAddressEntity[];
}
