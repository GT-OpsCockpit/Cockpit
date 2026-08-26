import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EnvironmentVariables } from '../config/env.validation';
import { OtpMailerService } from './otp-mailer.service';
import { SESSION_COOKIE_NAME } from '../common/guards/session-auth.guard';
import type { Response } from 'express';

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;

// A real argon2 hash computed once and cached, verified against on every
// login attempt for an email that doesn't exist. Keeps login()'s response
// time close to the "user exists" path instead of returning instantly,
// which would otherwise leak which emails are registered.
let dummyHash: Promise<string> | undefined;
function getDummyHash(): Promise<string> {
  dummyHash ??= argon2.hash(randomInt(0, 2 ** 48 - 1).toString());
  return dummyHash;
}

export interface LoginResult {
  devCode?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly mailer: OtpMailerService,
  ) {}

  private get devOtpAllowed(): boolean {
    return (
      this.config.get('NODE_ENV', { infer: true }) !== 'production' &&
      this.config.get('AUTH_DEV_OTP', { infer: true }) === 'true'
    );
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const passwordValid = await argon2.verify(
      user?.passwordHash ?? (await getDummyHash()),
      password,
    );

    if (!user || !user.active || !passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const code = randomInt(0, 1_000_000).toString().padStart(OTP_LENGTH, '0');
    const codeHash = await argon2.hash(code);
    await this.prisma.otpCode.deleteMany({ where: { userId: user.id } });
    await this.prisma.otpCode.create({
      data: {
        userId: user.id,
        codeHash,
        expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
      },
    });

    if (this.mailer.isConfigured) {
      await this.mailer.sendOtp(user.email, code);
      return {};
    }

    if (this.devOtpAllowed) {
      this.logger.warn(
        `AUTH_DEV_OTP is active: returning the OTP code in the API response for ${user.email}. This must never happen in production.`,
      );
      return { devCode: code };
    }

    throw new InternalServerErrorException(
      'Email delivery is not configured (SMTP_HOST missing) and AUTH_DEV_OTP is disabled',
    );
  }

  async verify(
    email: string,
    code: string,
    res: Response,
  ): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid code');

    const otp = await this.prisma.otpCode.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp || otp.expiresAt < new Date()) {
      throw new BadRequestException('No pending verification code');
    }
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      throw new HttpException(
        'Too many attempts, request a new code',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const valid = await argon2.verify(otp.codeHash, code);
    if (!valid) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Invalid code');
    }

    await this.prisma.otpCode.deleteMany({ where: { userId: user.id } });

    const ttlDays = this.config.get('SESSION_TTL_DAYS', { infer: true });
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
      },
    });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    res.cookie(SESSION_COOKIE_NAME, session.id, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: ttlDays * 24 * 60 * 60 * 1000,
    });
    return { ok: true };
  }

  async verifyPassword(
    userId: string,
    password: string,
  ): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) throw new UnauthorizedException('Invalid password');
    return { ok: true };
  }

  async logout(sessionId: string | undefined, res: Response): Promise<void> {
    if (sessionId) {
      await this.prisma.session.deleteMany({ where: { id: sessionId } });
    }
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  }
}
