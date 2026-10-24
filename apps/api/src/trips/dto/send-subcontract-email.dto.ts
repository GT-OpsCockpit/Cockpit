import { IsOptional, IsString } from 'class-validator';
import { SubcontractEmailQueryDto } from './subcontract-email-query.dto';

/**
 * Sends the real email a `GET .../subcontract-email` call previously
 * previewed — same `kind`/`partnerRef`, plus the subject/body the dispatcher
 * reviewed (and may have tweaked) in that preview, so what gets sent is
 * exactly what they read, not a freshly recomputed draft that could have
 * silently drifted from it.
 */
export class SendSubcontractEmailDto extends SubcontractEmailQueryDto {
  @IsString()
  subject: string;

  @IsString()
  body: string;
}
