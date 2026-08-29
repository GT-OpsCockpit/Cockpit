import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { Button } from '@/components/ui/button'
import { ConfirmActionDialog } from '@/components/confirm-action-dialog'
import { usePermission } from '@/features/auth/use-permission'

/**
 * "Delete permanently" — the one action that removes a roster record rather
 * than deactivating it.
 *
 * The legacy offered it from inside each edit popup, behind the Manager
 * password (onPermanentDelete, common.js:385-395, 3450-3457). v2 kept the four
 * endpoints and the `record:delete` permission that replaced that password,
 * but no screen ever called them — so the action existed and was unreachable.
 *
 * Deactivating is the everyday move and stays the default; this is for a
 * record created in error. The API refuses it outright when anything still
 * references the record, and that refusal is surfaced as-is.
 */
export function PermanentDeleteAction({
  label,
  description,
  onDelete,
  invalidateKey,
  onDeleted,
}: {
  /** What is being deleted, for the confirm dialog's title — e.g. "account CI1". */
  label: string
  description: string
  onDelete: () => Promise<unknown>
  invalidateKey: readonly unknown[]
  onDeleted: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)

  // UX-layer mirror of the server-side gate (record:delete — see
  // docs/agents/permissions.md). The API enforces it independently.
  const canDelete = usePermission('record:delete')
  if (!canDelete) return null

  const confirm = async () => {
    setPending(true)
    try {
      await onDelete()
      toast.success(`Deleted ${label}.`)
      void queryClient.invalidateQueries({ queryKey: invalidateKey })
      setConfirming(false)
      onDeleted()
    } catch (error) {
      toast.error(getApiErrorMessage(error, `Error deleting ${label}.`))
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Button type="button" variant="ghost" className="text-destructive mr-auto" onClick={() => setConfirming(true)}>
        <Trash2 className="size-3.5" />
        Delete permanently
      </Button>
      <ConfirmActionDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Delete ${label} for good?`}
        description={description}
        confirmLabel="Delete permanently"
        pending={pending}
        onConfirm={confirm}
      />
    </>
  )
}
