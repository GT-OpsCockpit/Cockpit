import { IsNotEmpty, IsString } from 'class-validator';

export class CorrectInvoiceDto {
  /** The signed-in admin's own password, asked again before an invoice is taken back. */
  @IsString()
  @IsNotEmpty()
  password: string;
}
