import { Injectable, Logger } from '@nestjs/common';
import { WhatsAppProvider } from './whatsapp-provider.interface';

/**
 * Fallback used when TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN are absent (local
 * dev without Twilio credentials). Logs the message instead of failing, so
 * the dispatch/notify/advance-step workflow stays testable end-to-end.
 * NotificationsModule only wires this in when Twilio isn't configured —
 * never a silent substitute in an environment that has real credentials.
 */
@Injectable()
export class DevLogWhatsAppProvider implements WhatsAppProvider {
  private readonly logger = new Logger('WhatsApp(dev)');

  async send(phone: string, body: string): Promise<void> {
    this.logger.warn(
      `[not sent — Twilio not configured] to +${phone}: ${body}`,
    );
    await Promise.resolve();
  }
}
