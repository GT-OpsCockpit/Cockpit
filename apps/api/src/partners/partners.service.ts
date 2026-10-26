import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RefCounterService } from '../common/ref-counter/ref-counter.service';
import { normalizePhone } from '../common/utils/normalize-phone';
import { letters } from '../common/utils/letters';
import {
  FLEET_MAKES,
  FLEET_MODELS_BY_MAKE,
  FLEET_COLOR_VALUES,
  FLEET_DEFAULT_COLOR,
  CATEGORY_MODELS,
  getFleetYearWindow,
} from '../common/constants/fleet';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { PartnerEntity } from './dto/partner.entity';
import { OkResponseEntity } from '../common/dto/ok-response.entity';
import { driverDisplayName } from '@cockpit/shared';
import type { Partner, Prisma } from '../../generated/prisma/client';

const PARTNER_INCLUDE = {
  drivers: true,
  fleetVehicles: true,
} satisfies Prisma.PartnerInclude;

function driverRefPrefix(
  countryCode: string | null | undefined,
  area: string | null | undefined,
  company: string | null | undefined,
): string {
  if (!company?.trim()) return 'D-FR-INT';
  const countryPart = (countryCode ?? '').split('-')[0].toUpperCase() || 'XX';
  const areaPart = letters(area, 2) || 'XX';
  const companyPart = letters(company, 3) || 'XXX';
  return `D-${countryPart}-${areaPart}-${companyPart}`;
}

type PartnerWithRoster = Prisma.PartnerGetPayload<{
  include: typeof PARTNER_INCLUDE;
}>;

function toEntity(partner: PartnerWithRoster): PartnerEntity {
  return {
    id: partner.id,
    ref: partner.ref,
    individual: partner.individual,
    companyName: partner.companyName,
    contactName: partner.contactName,
    phone: partner.phone,
    mobile: partner.mobile,
    email: partner.email,
    countryCode: partner.countryCode,
    area: partner.area,
    active: partner.active,
    createdAt: partner.createdAt,
    updatedAt: partner.updatedAt,
    drivers: partner.drivers.map((driver) => ({
      id: driver.id,
      ref: driver.ref,
      name: driverDisplayName(driver),
      phone: driver.phone,
    })),
    fleetVehicles: partner.fleetVehicles.map((vehicle) => ({
      id: vehicle.id,
      ref: vehicle.ref,
      make: vehicle.make,
      model: vehicle.model,
      regNbr: vehicle.regNbr,
    })),
  };
}

@Injectable()
export class PartnersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refCounter: RefCounterService,
  ) {}

  async list(includeInactive = false, category?: string): Promise<PartnerEntity[]> {
    const where: Prisma.PartnerWhereInput = includeInactive ? {} : { active: true };
    if (category) where.fleetVehicles = { some: { category: { name: category } } };
    const partners = await this.prisma.partner.findMany({
      where,
      include: PARTNER_INCLUDE,
      orderBy: [{ active: 'desc' }, { companyName: 'asc' }, { contactName: 'asc' }],
    });
    return partners.map(toEntity);
  }

  async create(dto: CreatePartnerDto): Promise<PartnerEntity> {
    if (!dto.individual && !dto.companyName?.trim()) {
      throw new BadRequestException(
        'Company name is required unless this partner is an individual.',
      );
    }
    // The landline is optional, but an Individual partner's own driver record
    // (created below) needs a number to reach them on.
    if (dto.individual && !dto.phone && !dto.mobile) {
      throw new BadRequestException(
        'A phone or a mobile number is required for an individual partner.',
      );
    }
    const seq = await this.refCounter.next('partner');
    const partner = await this.prisma.partner.create({
      data: {
        ref: `P${seq}`,
        individual: !!dto.individual,
        companyName: dto.individual ? null : dto.companyName!.trim(),
        contactName: dto.contactName,
        phone: dto.phone || null,
        mobile: dto.mobile || null,
        email: dto.email,
        countryCode: dto.countryCode ?? null,
        area: dto.area ?? null,
      },
    });

    // An Individual partner's own vehicle, filled in on the same popup
    // (validated ask: "Si individual coché alors apparaît les infos pour
    // créer le véhicule à linker à ce chauffeur") — creates a real Driver
    // (which is why it also shows up in the Drivers table, attached to this
    // Partner) and a FleetVehicle reserved to that driver, in one request
    // instead of the separate "New driver" + "Link a vehicle" two-step flow.
    if (
      dto.individual &&
      dto.vehicleRegNbr &&
      dto.vehicleCategory &&
      dto.vehicleMake &&
      dto.vehicleModel
    ) {
      await this.createIndividualRoster(partner, dto);
    }

    const full = await this.prisma.partner.findUniqueOrThrow({
      where: { ref: partner.ref },
      include: PARTNER_INCLUDE,
    });
    return toEntity(full);
  }

  /**
   * Driver + FleetVehicle for a freshly-created Individual Partner — see the
   * call site's comment. Not wrapped in a $transaction: RefCounterService's
   * atomic increment runs on its own connection either way (same accepted
   * pattern as DriversService/FleetVehiclesService's own multi-step creates
   * elsewhere in this codebase), and every field is validated up front
   * before any write happens, so a validation failure here never leaves a
   * half-created roster behind — only a genuine mid-write DB error could,
   * same residual risk as the rest of the app.
   */
  private async createIndividualRoster(
    partner: Partner,
    dto: CreatePartnerDto,
  ): Promise<void> {
    const driverPhone = normalizePhone(dto.mobile || dto.phone);
    if (driverPhone) {
      const existingDriver = await this.prisma.driver.findUnique({
        where: { phone: driverPhone },
      });
      if (existingDriver) {
        throw new ConflictException(
          `Phone ${dto.mobile || dto.phone} is already used by driver ${existingDriver.ref} — use a different number for this partner's own driver record.`,
        );
      }
    }

    const category = await this.prisma.vehicleType.findUnique({
      where: { name: dto.vehicleCategory! },
    });
    if (!category) {
      throw new BadRequestException(
        'vehicleCategory must match an existing vehicle type',
      );
    }
    if (!FLEET_MAKES.includes(dto.vehicleMake!)) {
      throw new BadRequestException('invalid vehicle make');
    }
    if (!FLEET_MODELS_BY_MAKE[dto.vehicleMake!]?.includes(dto.vehicleModel!)) {
      throw new BadRequestException('invalid vehicle model for this make');
    }
    const categoryModels = CATEGORY_MODELS[dto.vehicleCategory!];
    if (
      categoryModels &&
      !categoryModels[dto.vehicleMake!]?.includes(dto.vehicleModel!)
    ) {
      throw new BadRequestException(
        `${dto.vehicleMake} ${dto.vehicleModel} is not a valid vehicle for the "${dto.vehicleCategory}" Category`,
      );
    }
    if (dto.vehicleColor && !FLEET_COLOR_VALUES.includes(dto.vehicleColor)) {
      throw new BadRequestException('invalid vehicle color');
    }
    const regNbr = dto.vehicleRegNbr!.trim();
    const existingVehicle = await this.prisma.fleetVehicle.findFirst({
      where: { regNbr: { equals: regNbr, mode: 'insensitive' } },
    });
    if (existingVehicle) {
      throw new ConflictException(
        `A vehicle with registration "${regNbr}" already exists`,
      );
    }

    // company/`partnerCompany` still carry the partner's name (see
    // Driver.company's and FleetVehicle.partnerCompany's own comments in
    // schema.prisma) — kept consistent with every other partner-attached
    // driver/vehicle, not just the ones created from this shortcut.
    const prefix = driverRefPrefix(
      partner.countryCode,
      partner.area,
      partner.contactName,
    );
    const driverSeq = await this.refCounter.next(`driver:${prefix}`);
    const driverRef = `${prefix}-${String(driverSeq).padStart(3, '0')}`;
    const driver = await this.prisma.driver.create({
      data: {
        ref: driverRef,
        countryCode: partner.countryCode,
        firstName: dto.firstName || null,
        lastName: dto.lastName || null,
        phone: driverPhone,
        email: dto.email || null,
        company: partner.contactName,
        partnerId: partner.id,
        area: partner.area?.trim() || 'Local',
      },
    });

    const vehicleSeq = await this.refCounter.next('fleetVehicle');
    await this.prisma.fleetVehicle.create({
      data: {
        ref: `F${vehicleSeq}`,
        categoryId: category.id,
        regNbr,
        make: dto.vehicleMake!,
        model: dto.vehicleModel!,
        yearOfBuild: getFleetYearWindow().max,
        fourWD: !!dto.vehicleFourWD,
        nbPax: category.maxPax,
        color: dto.vehicleColor || FLEET_DEFAULT_COLOR,
        isLocal: false,
        countryCode: partner.countryCode,
        area: partner.area,
        partnerCompany: partner.contactName,
        partnerId: partner.id,
        driverId: driver.id,
      },
    });
  }

  async update(ref: string, dto: UpdatePartnerDto): Promise<PartnerEntity> {
    const existing = await this.findByRefOrThrow(ref);
    const individual = dto.individual ?? existing.individual;
    const companyName =
      dto.companyName !== undefined ? dto.companyName : existing.companyName;
    if (!individual && !companyName?.trim()) {
      throw new BadRequestException(
        'Company name is required unless this partner is an individual.',
      );
    }
    const partner = await this.prisma.partner.update({
      where: { ref },
      data: {
        ...(dto.individual !== undefined && { individual: dto.individual }),
        // Switching to individual clears the company name, same as the
        // create path — an individual partner has none.
        ...(dto.individual === true && { companyName: null }),
        ...(dto.individual !== true &&
          dto.companyName !== undefined && {
            companyName: dto.companyName?.trim() || null,
          }),
        ...(dto.contactName !== undefined && { contactName: dto.contactName }),
        ...(dto.phone !== undefined && { phone: dto.phone || null }),
        ...(dto.mobile !== undefined && { mobile: dto.mobile || null }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.countryCode !== undefined && { countryCode: dto.countryCode || null }),
        ...(dto.area !== undefined && { area: dto.area || null }),
      },
      include: PARTNER_INCLUDE,
    });
    return toEntity(partner);
  }

  async setActive(ref: string, active: boolean): Promise<PartnerEntity> {
    await this.findByRefOrThrow(ref);
    const partner = await this.prisma.partner.update({
      where: { ref },
      data: { active },
      include: PARTNER_INCLUDE,
    });
    return toEntity(partner);
  }

  async delete(ref: string): Promise<OkResponseEntity> {
    const partner = await this.findByRefOrThrow(ref);
    const [driverCount, vehicleCount] = await Promise.all([
      this.prisma.driver.count({ where: { partnerId: partner.id } }),
      this.prisma.fleetVehicle.count({ where: { partnerId: partner.id } }),
    ]);
    if (driverCount > 0 || vehicleCount > 0) {
      throw new BadRequestException(
        'This partner still has drivers or vehicles attached and cannot be deleted — deactivate it instead.',
      );
    }
    await this.prisma.partner.delete({ where: { ref: partner.ref } });
    return { ok: true };
  }

  /** Resolves a Partner by ref, throwing the same way every other module's create/update paths do for a bad ref. */
  async resolveByRefOrThrow(ref: string) {
    const partner = await this.prisma.partner.findUnique({ where: { ref } });
    if (!partner) {
      throw new BadRequestException(`partnerRef "${ref}" does not match an existing partner`);
    }
    return partner;
  }

  private async findByRefOrThrow(ref: string) {
    const partner = await this.prisma.partner.findUnique({ where: { ref } });
    if (!partner) throw new NotFoundException('Partner not found');
    return partner;
  }
}
