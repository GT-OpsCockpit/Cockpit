import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';

/** Key prefix inside the shared storage bucket — the S3 counterpart of the old `./uploads/nameboards` folder. */
export const NAMEBOARD_KEY_PREFIX = 'nameboards';

/**
 * Public URL prefix under which NameboardController proxies the stored object
 * back. Kept out of the `/api` global prefix (see bootstrap.ts) so the URLs
 * already persisted in `trip.nameboardUrl` keep resolving unchanged.
 */
export const NAMEBOARD_URL_PREFIX = `/uploads/${NAMEBOARD_KEY_PREFIX}`;

/**
 * Replaces the legacy's base64 blob stored inline on the trip record with an
 * object in S3-compatible storage — see ADR-0004. Memory storage, not disk:
 * the buffer is handed straight
 * to StorageService, nothing ever touches the container filesystem.
 */
export const nameboardMulterOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
};

/** The subset of Multer's memory-storage file the nameboard upload actually uses. */
export interface UploadedNameboard {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}
