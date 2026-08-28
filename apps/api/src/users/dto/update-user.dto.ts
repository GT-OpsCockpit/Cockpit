import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '../../../generated/prisma/enums';
import {
  IsEmailFormat,
  IsPhone,
} from '../../common/validators/contact.validators';

export class UpdateUserDto {
  @IsEmailFormat()
  email: string;

  @IsEnum(Role)
  role: Role;

  @IsString()
  @MinLength(1)
  firstName: string;

  @IsString()
  @MinLength(1)
  lastName: string;

  @IsOptional()
  @IsPhone()
  phone?: string;
}
