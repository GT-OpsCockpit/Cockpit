import { BadRequestException } from '@nestjs/common';
import { missingFields } from '@cockpit/shared';
import type { RecordKind, RecordValues } from '@cockpit/shared';

/**
 * The API's half of the required-fields seam: the same rules the web forms
 * read (packages/shared/src/business/record-requirements.js), turned into the
 * 400 this transport owes.
 *
 * Only the first gap is reported. A form can show four messages at once
 * because it has four fields on screen; an HTTP error carries one, and the
 * caller fixes them one at a time — which is exactly what the three services
 * did before, each throwing on the first thing it found missing.
 */
export function assertRequiredFields(
  kind: RecordKind,
  values: RecordValues,
): void {
  const [firstGap] = missingFields(kind, values);
  if (firstGap) throw new BadRequestException(firstGap.message);
}
