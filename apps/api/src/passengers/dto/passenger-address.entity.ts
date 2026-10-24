export class PassengerAddressEntity {
  id: string;
  passengerId: string;
  title: string;
  address: string;
  info: string | null;
  countryCode: string | null;
  postalCode: string | null;
  area: string | null;
  isAirport: boolean;
  createdAt: Date;
  updatedAt: Date;
}
