import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getBaseUrl, tripsControllerSubcontractEmail, tripsControllerSendSubcontractEmail } from '@cockpit/shared/api'
import type { TripsControllerSubcontractEmailKind } from '@cockpit/shared/api'
import { getApiErrorMessage } from '@/lib/api-error'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// Matches subcontract-email.util.ts's NAMEBOARD_URL_PREFIX — see subcontract-email.ts,
// which this dialog replaces (a mailto: draft can't force a From address, and
// the requester needs the real sender to be contact@gt-ops.club — see
// docs/feature-requests/partner-companies.md §6).
const NAMEBOARD_PATH = /\/uploads\/nameboards\/\S+/

export interface SubcontractEmailTarget {
  ref: string
  kind: TripsControllerSubcontractEmailKind
  /** Whose draft to write, when the trip no longer holds them (see subcontract-email.ts's own note on ordering). */
  partnerRef?: string
}

/**
 * The dispatcher's review-then-send step for a sub-contracted job's partner
 * notification (mission recap on assign, updated recap after an edit,
 * cancellation notice on unassign or cancel). Fetches the composed draft, lets the dispatcher edit it, and only
 * sends — for real, server-side, from contact@gt-ops.club — on an explicit
 * click. Never sends automatically.
 */
export function SubcontractEmailDialog({
  target,
  onOpenChange,
}: {
  target: SubcontractEmailTarget | null
  onOpenChange: (open: boolean) => void
}) {
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [to, setTo] = useState<string | null>(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  useEffect(() => {
    if (!target) return
    setLoading(true)
    setTo(null)
    tripsControllerSubcontractEmail(target.ref, { kind: target.kind, partnerRef: target.partnerRef })
      .then((draft) => {
        setTo(draft.to)
        setSubject(draft.subject)
        setBody(draft.to ? draft.body.replace(NAMEBOARD_PATH, (path) => `${getBaseUrl()}${path}`) : draft.body)
      })
      .catch((error) => {
        toast.warning(getApiErrorMessage(error, 'Could not prepare the partner email.'))
        onOpenChange(false)
      })
      .finally(() => setLoading(false))
    // Re-run only when the target itself changes — not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.ref, target?.kind, target?.partnerRef])

  const send = async () => {
    if (!target) return
    setSending(true)
    try {
      await tripsControllerSendSubcontractEmail(target.ref, {
        kind: target.kind,
        partnerRef: target.partnerRef,
        subject,
        body,
      })
      toast.success(`Email sent to ${to}.`)
      onOpenChange(false)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not send the partner email.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {target?.kind === 'cancelled'
              ? 'Cancellation notice to partner'
              : target?.kind === 'updated'
                ? 'Send updated booking to partner'
                : 'Notify partner'}
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : !to ? (
          <p className="text-muted-foreground text-sm">
            No email address on file for this partner — nothing to send.
          </p>
        ) : (
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>To</Label>
              <Input readOnly value={to} />
            </div>
            <div className="grid gap-1.5">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Message</Label>
              <Textarea rows={12} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {to ? 'Discard' : 'Close'}
          </Button>
          {to && (
            <Button type="button" onClick={send} disabled={loading || sending}>
              {sending && <Spinner />}
              Send
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
