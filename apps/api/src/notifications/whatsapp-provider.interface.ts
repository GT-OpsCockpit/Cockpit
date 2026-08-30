export const WHATSAPP_PROVIDER = Symbol('WHATSAPP_PROVIDER');

/**
 * Encapsulates the WhatsApp channel behind a swappable interface — v1 ships
 * only TwilioWhatsAppProvider, but a Dialog360/Meta Cloud provider can be
 * added later without touching call sites (see ADR-0002).
 */
export interface WhatsAppProvider {
  send(phone: string, body: string): Promise<void>;
}
