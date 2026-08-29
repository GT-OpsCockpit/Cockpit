import { IsEnum, IsString, MinLength } from 'class-validator';
import { Role } from '../../../generated/prisma/enums';
import {
  IsEmailFormat,
  IsPhone,
} from '../../common/validators/contact.validators';

export class CreateUserDto {
  @IsEmailFormat()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsEnum(Role)
  role: Role;

  @IsString()
  @MinLength(1)
  firstName: string;

  @IsString()
  @MinLength(1)
  lastName: string;

  /**
   * Required, as the legacy required it of every access account on create and
   * on edit alike (server.js:262-264, 275-277) — it is how a dispatcher is
   * reached off-hours, not decoration.
   */
  @IsPhone()
  phone: string;
}
