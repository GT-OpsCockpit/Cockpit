import { useState } from 'react'
import { toast } from 'sonner'
import type { InvoiceEntity } from '@cockpit/shared/api'
import {
  getInvoicesControllerListQueryKey,
  getTripsControllerListQueryKey,
  useInvoicesControllerCorrect,
} from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { ConfirmActionDialog } from '@/components/confirm-action-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Takes an invoice back so it can be corrected: its trips return to the Pending
 * list and the invoice disappears from Invoiced. Behind the admin's password.
 */
export function InvoiceCorrectDialog({
  invoice,
  onOpenChange,
}: {
  invoice: InvoiceEntity | null
  onOpenChange: (open: boolean) => void
}) {
  const [password, setPassword] = useState('')
  const correct = useInvoicesControllerCorrect()

  const close = (open: boolean) => {
    if (!open) setPassword('')
    onOpenChange(open)
  }

  const confirm = async () => {
    if (!invoice) return
    try {
      await correct.mutateAsync({ ref: invoice.ref, data: { password } })
      toast.success(`Invoice ${invoice.ref} taken back — its trips are pending again.`)
      void queryClient.invalidateQueries({ queryKey: getTripsControllerListQueryKey() })
      void queryClient.invalidateQueries({ queryKey: getInvoicesControllerListQueryKey() })
      close(false)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error correcting the invoice.'))
    }
  }

  return (
    <ConfirmActionDialog
      open={!!invoice}
      onOpenChange={close}
      title="Correct this invoice?"
      description={
        invoice &&
        `Invoice ${invoice.ref} will be removed and its ${invoice.trips.length} trip(s) will go back to the Pending list, ready to be invoiced again.`
      }
      confirmLabel="Correct invoice"
      pending={correct.isPending}
      confirmDisabled={!password}
      onConfirm={confirm}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="invoice-correct-password">Admin code (your login password)</Label>
        <Input
          id="invoice-correct-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
    </ConfirmActionDialog>
  )
}
