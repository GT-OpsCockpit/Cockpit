import { ApiProperty } from '@nestjs/swagger';
import { VehicleTypeEntity } from '../../fleet/dto/vehicle-type.entity';

export class CountryEntity {
  name: string;
  code: string;
  dial?: string;
  tz: string;
  currency: string;
}

export class MajorCityEntity {
  name: string;
  country: string;
}

export class BillingOptionEntity {
  value: string;
  label: string;
}

export class FleetColorEntity {
  value: string;
  hex: string;
}

/** Static/reference data bundle the frontend loads once on boot. */
export class MetaEntity {
  countries: CountryEntity[];
  vehicleTypes: VehicleTypeEntity[];
  billingOptions: BillingOptionEntity[];
  fleetMakes: string[];

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'array', items: { type: 'string' } },
    description: 'Available models keyed by make.',
  })
  fleetModelsByMake: Record<string, string[]>;

  fleetMinYear: number;
  fleetMaxYear: number;
  majorCities: MajorCityEntity[];

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'array', items: { type: 'string' } },
    description: 'Compatible fleet categories keyed by vehicle-type name.',
  })
  vehicleCompatibility: Record<string, string[]>;

  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'object',
      additionalProperties: { type: 'array', items: { type: 'string' } },
    },
    description: 'Allowed models keyed by [category][make].',
  })
  categoryModels: Record<string, Record<string, string[]>>;

  fleetColors: FleetColorEntity[];
  fleetDefaultColor: string;
}
