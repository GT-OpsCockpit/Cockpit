import { IsNotEmpty, IsString } from 'class-validator';

export class CompleteSubcontractDto {
  /** The signed-in admin's own password, asked again before a booking is closed by hand. */
  @IsString()
  @IsNotEmpty()
  password: string;
}
