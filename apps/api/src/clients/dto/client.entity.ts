import { ClientType, Billing } from '../../../generated/prisma/enums';

/** Raw Client record fields (no derived/computed properties). */
export class ClientBaseEntity {
  id: string;
  ref: string;
  clientType: ClientType;
  contactFirstName: string | null;
  contactLastName: string | null;
  company: string | null;
  acronym: string | null;
  refPoOther: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  countryCode: string | null;
  vatNumber: string | null;
  email: string | null;
  billing: Billing | null;
  pocName: string | null;
  pocPhone: string | null;
  pocEmail: string | null;
  eventCountry: string | null;
  eventArea: string | null;
  eventStartDate: Date | null;
  eventEndDate: Date | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** A Client account, plus the derived display `name` computeClientName() adds on every clients-module read. */
export class ClientEntity extends ClientBaseEntity {
  name: string;
}
