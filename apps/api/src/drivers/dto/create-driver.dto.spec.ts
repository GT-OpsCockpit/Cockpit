import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateDriverDto } from './create-driver.dto';

function errorsFor(field: string, value: unknown) {
  const dto = plainToInstance(CreateDriverDto, { [field]: value });
  return validate(dto).then((errors) =>
    errors.filter((e) => e.property === field),
  );
}

// The edit form always submits the whole record, and drivers.service.ts's
// update() only writes a field when it's present at all (`!== undefined`), so
// a deliberately-cleared phone/email has to reach here as '' — not undefined
// — to actually get cleared. @IsPhone()/@IsEmailFormat() must therefore accept
// '' the same way the web form's own zod rule already does
// (optionalPhone/optionalEmail, contact-fields.ts), while still rejecting a
// real but malformed value.
describe('CreateDriverDto — phone/email', () => {
  it('accepts an empty phone (clearing it)', async () => {
    expect(await errorsFor('phone', '')).toHaveLength(0);
  });

  it('rejects a malformed, non-empty phone', async () => {
    expect(await errorsFor('phone', 'not a phone')).not.toHaveLength(0);
  });

  it('accepts a valid E.164 phone', async () => {
    expect(await errorsFor('phone', '+33612345678')).toHaveLength(0);
  });

  it('accepts an empty email (clearing it)', async () => {
    expect(await errorsFor('email', '')).toHaveLength(0);
  });

  it('rejects a malformed, non-empty email', async () => {
    expect(await errorsFor('email', 'not-an-email')).not.toHaveLength(0);
  });

  it('accepts a valid email', async () => {
    expect(await errorsFor('email', 'jane@example.test')).toHaveLength(0);
  });
});
