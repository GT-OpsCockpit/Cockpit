import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
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

  @IsOptional()
  @IsPhone()
  phone?: string;
}
