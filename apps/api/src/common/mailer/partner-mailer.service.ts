import { Injectable, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { EnvironmentVariables } from '../../config/env.validation';

/**
 * Sends the real, actually-delivered emails to a sub-contracted partner
 * (assign / unassign / cancel notices) — as opposed to the `mailto:` drafts
 * used elsewhere in the app. The requester was explicit that the sender has
 * to be `contact@gt-ops.club` specifically: a `mailto:` link can't force a
 * From address (it opens whatever mail client/account the dispatcher already
 * has), so this reuses the OTP mailer's `nodemailer`+SMTP pattern
 * (`OtpMailerService`) instead, still gated behind an explicit "Send" click
 * — never sent automatically. See docs/feature-requests/partner-companies.md §6.
 */
@Injectable()
export class PartnerMailerService implements OnModuleInit {
  private transporter?: Transporter;

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  onModuleInit() {
    const host = this.config.get('SMTP_HOST', { infer: true });
    if (!host) return;
    const user = this.config.get('SMTP_USER', { infer: true });
    const pass = this.config.get('SMTP_PASS', { infer: true });
    this.transporter = createTransport({
      host,
      port: this.config.get('SMTP_PORT', { infer: true }) ?? 587,
      auth: user ? { user, pass } : undefined,
    });
  }

  get isConfigured(): boolean {
    return !!this.transporter;
  }

  async send(
    to: string,
    subject: string,
    body: string,
    html?: string,
  ): Promise<void> {
    if (!this.transporter) {
      throw new ServiceUnavailableException(
        'Email sending is not configured on this server (missing SMTP_HOST) — the partner was not notified.',
      );
    }
    await this.transporter.sendMail({
      from: this.config.get('PARTNER_MAILER_FROM', { infer: true }),
      to,
      subject,
      text: body,
      ...(html ? { html } : {}),
    });
  }
}
