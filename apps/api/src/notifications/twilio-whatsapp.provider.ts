import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio, { Twilio } from 'twilio';
import { EnvironmentVariables } from '../config/env.validation';
import { normalizePhone } from '../common/utils/normalize-phone';
import { WhatsAppProvider } from './whatsapp-provider.interface';

@Injectable()
export class TwilioWhatsAppProvider implements WhatsAppProvider {
  private readonly client?: Twilio;
  private readonly from?: string;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    const accountSid = config.get('TWILIO_ACCOUNT_SID', { infer: true });
    const authToken = config.get('TWILIO_AUTH_TOKEN', { infer: true });
    this.from = config.get('TWILIO_WHATSAPP_FROM', { infer: true });
    if (accountSid && authToken) {
      this.client = twilio(accountSid, authToken);
    }
  }

  async send(phone: string, body: string): Promise<void> {
    if (!this.client || !this.from) {
      throw new InternalServerErrorException(
        'WhatsApp is not configured (TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_WHATSAPP_FROM)',
      );
    }
    await this.client.messages.create({
      from: this.from,
      to: `whatsapp:+${normalizePhone(phone)}`,
      body,
    });
  }
}
