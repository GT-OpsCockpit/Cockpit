import { plainToInstance, Type } from 'class-transformer';
import {
  IsBooleanString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export class EnvironmentVariables {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: 'development' | 'production' | 'test' = 'development';

  @Type(() => Number)
  @IsInt()
  PORT: number = 3000;

  @IsString()
  DATABASE_URL: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  SESSION_TTL_DAYS: number = 7;

  @IsEmail()
  ADMIN_EMAIL: string;

  @IsString()
  @MinLength(8)
  ADMIN_PASSWORD: string;

  @IsString()
  ADMIN_FIRST_NAME: string = 'Admin';

  @IsString()
  ADMIN_LAST_NAME: string = 'User';

  /**
   * DEV-ONLY BACKDOOR: when both this flag AND NODE_ENV !== 'production' are
   * true, `/api/auth/login` returns the OTP code in the JSON body (`devCode`)
   * instead of requiring SMTP. Mirrors the legacy prototype's fallback, kept
   * for local dev/tests without a mail server. NEVER set true in production —
   * NODE_ENV=production ignores this flag unconditionally regardless of value.
   */
  @IsBooleanString()
  AUTH_DEV_OTP: string = 'false';

  @IsOptional()
  @IsString()
  SMTP_HOST?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  SMTP_PORT?: number;

  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @IsOptional()
  @IsString()
  SMTP_PASS?: string;

  @IsOptional()
  @IsString()
  SMTP_FROM?: string;

  @IsOptional()
  @IsString()
  TWILIO_ACCOUNT_SID?: string;

  @IsOptional()
  @IsString()
  TWILIO_AUTH_TOKEN?: string;

  @IsOptional()
  @IsString()
  TWILIO_WHATSAPP_FROM?: string;

  @IsOptional()
  @IsString()
  FLIGHTSTATS_APP_ID?: string;

  @IsOptional()
  @IsString()
  FLIGHTSTATS_APP_KEY?: string;

  @IsString()
  NOMINATIM_USER_AGENT: string = 'CockpitV2/1.0';

  /**
   * S3-compatible object storage (see common/storage). Points at the
   * self-hosted MinIO service today; switching to a real provider
   * (AWS/OVH/Scaleway) is a matter of changing these values only.
   */
  @IsString()
  S3_ENDPOINT: string;

  /** Ignored by MinIO, required by real AWS S3. */
  @IsString()
  S3_REGION: string = 'us-east-1';

  @IsString()
  S3_ACCESS_KEY: string;

  @IsString()
  S3_SECRET_KEY: string;

  @IsString()
  S3_BUCKET: string;

  /** 'true' for MinIO (no wildcard DNS per bucket), 'false' for real AWS S3. */
  @IsBooleanString()
  S3_FORCE_PATH_STYLE: string = 'true';

  @IsString()
  CORS_ORIGIN: string = '*';

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  DEFAULT_VAT_RATE_PERCENT: number = 10;
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n${errors
        .map((e) => Object.values(e.constraints ?? {}).join(', '))
        .join('\n')}`,
    );
  }
  return validated;
}
