import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { EnvironmentVariables } from '../config/env.validation';

@Injectable()
export class OtpMailerService implements OnModuleInit {
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

  async sendOtp(to: string, code: string): Promise<void> {
    await this.transporter!.sendMail({
      from:
        this.config.get('SMTP_FROM', { infer: true }) ??
        'no-reply@cockpit.local',
      to,
      subject: 'Your Cockpit verification code',
      text: `Your verification code is ${code}. It expires in 5 minutes.`,
    });
  }
}
