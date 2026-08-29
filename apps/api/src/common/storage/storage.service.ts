import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import type { Readable } from 'node:stream';
import { EnvironmentVariables } from '../../config/env.validation';

export interface StoredObject {
  stream: Readable;
  contentType: string;
  /** Undefined only if the backend omits it; callers should fall back to chunked transfer. */
  contentLength?: number;
}

/** CreateBucket responses that mean "already there" — the S3 equivalent of `mkdirSync({ recursive: true })`. */
const BUCKET_EXISTS_ERRORS = ['BucketAlreadyOwnedByYou', 'BucketAlreadyExists'];

/**
 * Generic S3-compatible object storage, shared by every feature that needs to
 * persist an uploaded file (nameboards today, driver documents / invoice
 * attachments tomorrow). One bucket, keys namespaced per feature
 * (`<feature>/<uuid><ext>`) — the prefix plays the role the `./uploads/<feature>`
 * folder used to play on the container disk.
 *
 * Nothing here is provider-specific: it is driven entirely by the S3_* env vars,
 * so moving from the self-hosted MinIO to a real provider (AWS/OVH/Scaleway) is
 * a config change, not a code change.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.bucket = config.get('S3_BUCKET', { infer: true });
    this.client = new S3Client({
      endpoint: config.get('S3_ENDPOINT', { infer: true }),
      region: config.get('S3_REGION', { infer: true }),
      // MinIO (and most self-hosted S3 servers) have no wildcard DNS for
      // `<bucket>.<host>`, so the bucket has to travel in the URL path. Real
      // AWS S3 wants the opposite — hence the env var rather than a constant.
      forcePathStyle:
        config.get('S3_FORCE_PATH_STYLE', { infer: true }) === 'true',
      credentials: {
        accessKeyId: config.get('S3_ACCESS_KEY', { infer: true }),
        secretAccessKey: config.get('S3_SECRET_KEY', { infer: true }),
      },
    });
  }

  /**
   * Creates the bucket if it doesn't exist yet. Any other failure (unreachable
   * endpoint, bad credentials) is left to propagate and abort the boot: a
   * storage backend that is silently broken is exactly the failure mode this
   * whole migration exists to remove.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Created storage bucket "${this.bucket}"`);
    } catch (error) {
      if (!BUCKET_EXISTS_ERRORS.includes((error as Error).name)) throw error;
    }
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      },
    }).done();
  }

  /** Throws NotFoundException when the key doesn't exist, so callers can just let it bubble up as a 404. */
  async get(key: string): Promise<StoredObject> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        stream: result.Body as Readable,
        contentType: result.ContentType ?? 'application/octet-stream',
        contentLength: result.ContentLength,
      };
    } catch (error) {
      if ((error as Error).name === 'NoSuchKey') {
        throw new NotFoundException('File not found');
      }
      throw error;
    }
  }

  /**
   * Best-effort delete: a failure is logged, never thrown. Callers use this to
   * clean up a replaced file, and losing that cleanup must not fail the write
   * that triggered it.
   */
  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to delete storage object "${key}": ${(error as Error).message}`,
      );
    }
  }
}
