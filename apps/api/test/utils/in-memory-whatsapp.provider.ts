import { Injectable } from '@nestjs/common';
import { WhatsAppProvider } from '../../src/notifications/whatsapp-provider.interface';

export interface SentMessage {
  phone: string;
  body: string;
}

/** Test double for WHATSAPP_PROVIDER — records messages instead of calling Twilio. */
@Injectable()
export class InMemoryWhatsAppProvider implements WhatsAppProvider {
  readonly sent: SentMessage[] = [];
  failNext = false;

  async send(phone: string, body: string): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('Simulated WhatsApp failure');
    }
    this.sent.push({ phone, body });
    await Promise.resolve();
  }

  clear(): void {
    this.sent.length = 0;
  }
}
