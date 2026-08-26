import { randomUUID } from 'node:crypto';
import { basename, extname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { diskStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

const uploadDir = process.env.NAMEBOARD_UPLOAD_DIR ?? './uploads/nameboards';
mkdirSync(uploadDir, { recursive: true });

// Kept in sync with the /uploads static mount in bootstrap.ts, which serves
// the parent of NAMEBOARD_UPLOAD_DIR — so the URL must reuse its basename
// rather than a literal "nameboards" that would drift from a custom env value.
export const NAMEBOARD_URL_PREFIX = `/uploads/${basename(uploadDir)}`;

// Replaces the legacy's base64 blob stored inline on the trip record with a
// real file on a Docker volume — see docs/BACKEND_PLAN.md.
export const nameboardMulterOptions: MulterOptions = {
  storage: diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) =>
      cb(null, `${randomUUID()}${extname(file.originalname)}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
};
