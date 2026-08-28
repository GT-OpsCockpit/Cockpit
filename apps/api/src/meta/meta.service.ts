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
import { AreaSuggestionsEntity } from './dto/area-suggestions.entity';
import {
  areaSuggestions,
  isLocalAreaAllowed,
} from '../common/business/area-suggestions';

@Injectable()
export class MetaService {
  constructor(private readonly prisma: PrismaService) {}

  async getMeta(): Promise<MetaEntity> {
    // Active only: /meta feeds the pickers a dispatcher creates FROM (the
    // booking bar's Vehicle field, the fleet form's Category), so a type
    // deactivated on the Vehicles page must stop being offered. The Vehicles
    // management table has its own endpoint and still lists deactivated ones.
    const vehicleTypes = await this.prisma.vehicleType.findMany({
      where: { active: true },
    });
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

  /**
   * The Area field is constrained, not free-for-all: it suggests the major
   * cities of the country already chosen in the paired Country field, capped
   * by zone, and only offers "Local" in France (common.js:832,
   * initAreaCombo). The rule lives here rather than in the browser because
   * `area` drives the Local/Farm-out split and driver eligibility — a wrong
   * value cascades. Free text stays accepted, exactly as in the legacy: this
   * endpoint suggests, it doesn't close the list.
   */
  getAreaSuggestions(countryCode = ''): AreaSuggestionsEntity {
    return {
      countryCode,
      cities: areaSuggestions(countryCode),
      localAllowed: isLocalAreaAllowed(countryCode),
    };
  }
}
