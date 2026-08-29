import { Controller, Get, Param, StreamableFile } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { StorageService } from '../common/storage/storage.service';
import { Public } from '../common/decorators/public.decorator';
import { NAMEBOARD_KEY_PREFIX } from './nameboard-upload.config';

/**
 * Serves nameboard files back from the storage bucket. The bucket itself is
 * private and never exposed to the internet, so the API proxies reads — which
 * also keeps the URL shape (`/uploads/nameboards/<file>`) identical to the
 * `express.static` mount it replaces, so already-persisted `trip.nameboardUrl`
 * values and the frontend keep working untouched.
 *
 * Public on purpose (the driver/dashboard tracking pages that display a
 * nameboard are themselves public), and deliberately NOT a generic
 * `/uploads/:key(*)` route: the bucket is shared with future features whose
 * files may need authentication, so each feature exposes its own read route
 * with its own access rules on top of the same generic StorageService.
 */
@Controller('uploads/nameboards')
export class NameboardController {
  constructor(private readonly storage: StorageService) {}

  // Excluded from the OpenAPI spec (as the express.static mount it replaces
  // was): orval would otherwise generate a hook under the /api prefix this
  // route is precisely excluded from.
  @ApiExcludeEndpoint()
  @Public()
  @Get(':filename')
  async serve(@Param('filename') filename: string): Promise<StreamableFile> {
    const { stream, contentType, contentLength } = await this.storage.get(
      `${NAMEBOARD_KEY_PREFIX}/${filename}`,
    );
    // length keeps a real Content-Length on the response, as the express.static
    // mount used to send — without it the file goes out chunked and the browser
    // can't show download progress.
    return new StreamableFile(stream, {
      type: contentType,
      length: contentLength,
    });
  }
}
