import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { COUNTRIES } from '../common/constants/countries';
import { BILLING_OPTIONS } from '../common/constants/billing-options';
import {
  FLEET_MAKES,
  FLEET_MODELS_BY_MAKE,
  FLEET_COLORS,
  FLEET_DEFAULT_COLOR,
  CATEGORY_MODELS,
  getFleetYearWindow,
} from '../common/constants/fleet';
import { MAJOR_CITIES } from '../common/constants/major-cities';
import { VEHICLE_COMPATIBILITY } from '../common/constants/vehicle-compatibility';
import { MetaEntity } from './dto/meta.entity';

@Injectable()
export class MetaService {
  constructor(private readonly prisma: PrismaService) {}

  async getMeta(): Promise<MetaEntity> {
    const vehicleTypes = await this.prisma.vehicleType.findMany();
    vehicleTypes.sort(
      (a, b) =>
        (parseInt(a.ref.slice(1), 10) || 0) -
        (parseInt(b.ref.slice(1), 10) || 0),
    );
    const { min, max } = getFleetYearWindow();

    return {
      countries: COUNTRIES,
      vehicleTypes,
      // Shallow copy: BILLING_OPTIONS is `as const` (readonly tuple), the
      // response DTO field is a plain array — same data either way.
      billingOptions: [...BILLING_OPTIONS],
      fleetMakes: FLEET_MAKES,
      fleetModelsByMake: FLEET_MODELS_BY_MAKE,
      fleetMinYear: min,
      fleetMaxYear: max,
      majorCities: MAJOR_CITIES,
      vehicleCompatibility: VEHICLE_COMPATIBILITY,
      categoryModels: CATEGORY_MODELS,
      fleetColors: FLEET_COLORS,
      fleetDefaultColor: FLEET_DEFAULT_COLOR,
    };
  }
}
