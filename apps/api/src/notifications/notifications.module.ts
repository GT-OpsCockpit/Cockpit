import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { TwilioWhatsAppProvider } from './twilio-whatsapp.provider';
import { WHATSAPP_PROVIDER } from './whatsapp-provider.interface';

@Module({
  providers: [
    NotificationsService,
    { provide: WHATSAPP_PROVIDER, useClass: TwilioWhatsAppProvider },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
