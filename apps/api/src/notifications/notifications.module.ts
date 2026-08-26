import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { TwilioWhatsAppProvider } from './twilio-whatsapp.provider';
import { DevLogWhatsAppProvider } from './dev-log-whatsapp.provider';
import {
  WHATSAPP_PROVIDER,
  WhatsAppProvider,
} from './whatsapp-provider.interface';
import { EnvironmentVariables } from '../config/env.validation';

@Module({
  providers: [
    NotificationsService,
    TwilioWhatsAppProvider,
    DevLogWhatsAppProvider,
    {
      provide: WHATSAPP_PROVIDER,
      inject: [ConfigService, TwilioWhatsAppProvider, DevLogWhatsAppProvider],
      useFactory: (
        config: ConfigService<EnvironmentVariables, true>,
        twilio: TwilioWhatsAppProvider,
        devLog: DevLogWhatsAppProvider,
      ): WhatsAppProvider => {
        const configured =
          !!config.get('TWILIO_ACCOUNT_SID', { infer: true }) &&
          !!config.get('TWILIO_AUTH_TOKEN', { infer: true });
        const isProduction =
          config.get('NODE_ENV', { infer: true }) === 'production';
        // Never fall back to the dev-log provider in production: a missing
        // Twilio credential there must keep failing loudly (TwilioWhatsAppProvider
        // already throws on send), same guarantee as AUTH_DEV_OTP.
        return configured || isProduction ? twilio : devLog;
      },
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
