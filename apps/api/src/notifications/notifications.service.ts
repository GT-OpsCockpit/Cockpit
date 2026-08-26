import { Inject, Injectable } from '@nestjs/common';
import { WHATSAPP_PROVIDER } from './whatsapp-provider.interface';
import type { WhatsAppProvider } from './whatsapp-provider.interface';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(WHATSAPP_PROVIDER) private readonly provider: WhatsAppProvider,
  ) {}

  send(phone: string, body: string): Promise<void> {
    return this.provider.send(phone, body);
  }
}
