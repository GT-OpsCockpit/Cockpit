import { toast } from 'sonner'
import { tripsControllerSubcontractEmail } from '@cockpit/shared/api'
import type { TripsControllerSubcontractEmailKind } from '@cockpit/shared/api'

/**
 * Opens the dispatcher's own mail client on a pre-filled draft for a
 * sub-contracted job — the mission recap when it is farmed out, the
 * cancellation notice when it is taken back (openSubcontractEmailDraft /
 * openCanceledSubcontractEmailDraft, common.js:2636 and :2686).
 *
 * Nothing is sent by the app; this is the same as clicking "New email"
 * yourself, the dispatcher still presses Send. The body is composed
 * server-side (GET /trips/:ref/subcontract-email) — it needs the company
 * sheet, the partner's address and the trip's own timezone, none of which the
 * form holds. Same split as the invoice mailto (invoice-send.ts).
 *
 * Best effort by design: a booking is farmed out whether or not a draft can
 * be written, so a failure here never fails the save that preceded it.
 */
export async function openSubcontractEmailDraft(
  ref: string,
  kind: TripsControllerSubcontractEmailKind,
  /**
   * Whose draft to write, when the trip no longer holds them. The
   * cancellation notice needs this: the partner has to be read *before*
   * partnerRef is cleared, and the legacy had the same ordering constraint.
   */
  partnerRef?: string,
): Promise<void> {
  try {
    const draft = await tripsControllerSubcontractEmail(ref, { kind, partnerRef })
    // No address on file — the legacy simply drew no draft, rather than
    // opening an empty one the dispatcher would have to fill in themselves.
    if (!draft.to) {
      toast.warning('No email address on file for this partner — no draft was opened.')
      return
    }
    const subject = encodeURIComponent(draft.subject)
    const body = encodeURIComponent(draft.body)
    window.location.href = `mailto:${draft.to}?subject=${subject}&body=${body}`
  } catch {
    toast.warning('The booking was saved, but the partner email draft could not be prepared.')
  }
}
