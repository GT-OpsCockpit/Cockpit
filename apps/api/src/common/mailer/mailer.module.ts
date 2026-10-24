import { Module } from '@nestjs/common';
import { PartnerMailerService } from './partner-mailer.service';

@Module({
  providers: [PartnerMailerService],
  exports: [PartnerMailerService],
})
export class MailerModule {}
