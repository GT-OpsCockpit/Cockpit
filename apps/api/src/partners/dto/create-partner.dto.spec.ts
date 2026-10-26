import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePartnerDto } from './create-partner.dto';

function validBase(overrides: Partial<CreatePartnerDto> = {}): Record<string, unknown> {
  return {
    individual: false,
    companyName: 'Riviera VTC Services',
    contactName: 'Marc Voisin',
    phone: '+33612345678',
    email: 'dispatch@rivieravtc.fr',
    ...overrides,
  };
}

function validIndividual(overrides: Partial<CreatePartnerDto> = {}): Record<string, unknown> {
  return validBase({
    individual: true,
    companyName: undefined,
    contactName: 'Ahmed Ben Salah',
    firstName: 'Ahmed',
    lastName: 'Ben Salah',
    vehicleCategory: 'Business',
    vehicleMake: 'Mercedes-Benz',
    vehicleModel: 'E-Class',
    vehicleRegNbr: 'AB-123-CD',
    ...overrides,
  });
}

function errorsFor(overrides: Partial<CreatePartnerDto> = {}) {
  const dto = plainToInstance(CreatePartnerDto, validBase(overrides));
  return validate(dto);
}

describe('CreatePartnerDto', () => {
  it('accepts a fully valid company partner', async () => {
    expect(await errorsFor()).toHaveLength(0);
  });

  // The email is required — a partner Cockpit can't email defeats the point of
  // the feature (automatic notification on assign/unassign/cancel). The
  // landline is optional, but never malformed when given.
  describe('phone optional, email required — unlike Driver\'s', () => {
    it('accepts a missing phone', async () => {
      expect(await errorsFor({ phone: undefined })).toHaveLength(0);
    });

    it('accepts a blank phone — what the edit form sends to clear it', async () => {
      expect(await errorsFor({ phone: '' })).toHaveLength(0);
    });

    it('rejects a malformed phone', async () => {
      const errors = await errorsFor({ phone: 'not a phone' });
      expect(errors.map((e) => e.property)).toContain('phone');
    });

    it('rejects a missing email', async () => {
      const errors = await errorsFor({ email: undefined });
      expect(errors.map((e) => e.property)).toContain('email');
    });

    it('rejects a malformed email', async () => {
      const errors = await errorsFor({ email: 'not-an-email' });
      expect(errors.map((e) => e.property)).toContain('email');
    });
  });

  describe('mobile — optional, alongside phone', () => {
    it('accepts no mobile at all', async () => {
      const errors = await errorsFor({ mobile: undefined });
      expect(errors.map((e) => e.property)).not.toContain('mobile');
    });

    it('rejects a malformed mobile', async () => {
      const errors = await errorsFor({ mobile: 'not a phone' });
      expect(errors.map((e) => e.property)).toContain('mobile');
    });

    it('accepts a valid mobile', async () => {
      const errors = await errorsFor({ mobile: '+33698765432' });
      expect(errors.map((e) => e.property)).not.toContain('mobile');
    });
  });

  describe('companyName — required unless individual', () => {
    it('rejects a company partner with no company name', async () => {
      const errors = await errorsFor({ companyName: undefined });
      expect(errors.map((e) => e.property)).toContain('companyName');
    });

    it('accepts an individual partner with no company name (vehicle filled in)', async () => {
      const dto = plainToInstance(CreatePartnerDto, validIndividual());
      expect(await validate(dto)).toHaveLength(0);
    });
  });

  it('always requires a contact name, company or individual', async () => {
    const errors = await errorsFor({ contactName: undefined });
    expect(errors.map((e) => e.property)).toContain('contactName');
  });

  // The "New partner" popup reveals a vehicle section once Individual is
  // checked, so this partner's driver + vehicle can be created in the same
  // request (PartnersService.createIndividualRoster) — required at the DTO
  // level exactly when they'd be required in the UI.
  describe('vehicle fields — required only when individual', () => {
    it('does not require them for a company partner', async () => {
      const errors = await errorsFor();
      expect(errors.map((e) => e.property)).not.toEqual(
        expect.arrayContaining(['vehicleCategory', 'vehicleMake', 'vehicleModel', 'vehicleRegNbr']),
      );
    });

    it('requires category/make/model/regNbr for an individual', async () => {
      const dto = plainToInstance(
        CreatePartnerDto,
        validIndividual({
          vehicleCategory: undefined,
          vehicleMake: undefined,
          vehicleModel: undefined,
          vehicleRegNbr: undefined,
        }),
      );
      const errors = await validate(dto);
      const properties = errors.map((e) => e.property);
      expect(properties).toEqual(
        expect.arrayContaining(['vehicleCategory', 'vehicleMake', 'vehicleModel', 'vehicleRegNbr']),
      );
    });

    it('accepts a fully valid individual with their vehicle', async () => {
      const dto = plainToInstance(CreatePartnerDto, validIndividual());
      expect(await validate(dto)).toHaveLength(0);
    });
  });
});
