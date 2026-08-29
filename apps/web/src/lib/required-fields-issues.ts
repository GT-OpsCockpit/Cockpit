import type { z } from 'zod'
import { missingFields } from '@cockpit/shared'
import type { RecordKind, RecordValues } from '@cockpit/shared'

/**
 * The web's half of the required-fields seam: the same rules the API enforces
 * (packages/shared/src/business/record-requirements.js), turned into the form
 * issues react-hook-form needs.
 *
 * Every gap is reported, not just the first — a form has all its fields on
 * screen at once, so it can and should mark all of them. And a gap that names
 * several fields marks every one of them: "an Individual account needs a first
 * and last name" has to light up both boxes, not only the first.
 */
export function addRequiredFieldIssues(kind: RecordKind, values: RecordValues, ctx: z.RefinementCtx): void {
  for (const gap of missingFields(kind, values)) {
    for (const field of gap.fields) {
      ctx.addIssue({ code: 'custom', path: [field], message: gap.message })
    }
  }
}
