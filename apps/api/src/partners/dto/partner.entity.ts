/** Raw Partner record fields (no derived/computed properties). */
export class PartnerBaseEntity {
  id: string;
  ref: string;
  individual: boolean;
  companyName: string | null;
  contactName: string;
  phone: string;
  mobile: string | null;
  email: string;
  countryCode: string | null;
  area: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class PartnerRosterDriverEntity {
  id: string;
  ref: string;
  name: string;
  phone: string | null;
}

export class PartnerRosterVehicleEntity {
  id: string;
  ref: string;
  make: string;
  model: string;
  regNbr: string;
}

/**
 * A Partner, plus its own roster — the drivers and vehicles attached to it,
 * shown as a table on its Drivers & Partners card (see the validated
 * mockup, partners-mockup Main.dc.html). Empty for an individual partner,
 * who has no separate roster to manage.
 */
export class PartnerEntity extends PartnerBaseEntity {
  drivers: PartnerRosterDriverEntity[];
  fleetVehicles: PartnerRosterVehicleEntity[];
}
