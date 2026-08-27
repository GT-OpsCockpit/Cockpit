import { toast } from 'sonner'
import type { TripEntity } from '@cockpit/shared/api'
import { getInvoicesControllerListQueryKey, getTripsControllerListQueryKey, useInvoicesControllerCreate } from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

/**
 * "Invoice" button confirm step — snapshots the Pending trips currently on
 * screen into one invoice line (POST /api/invoices — server recomputes
 * totals from the authoritative trip.priceEur and flips trip.invoiced=true
 * on each one). Mirrors invoicing.html:392-418.
 */
export function InvoiceCreateDialog({
  open,
  onOpenChange,
  pendingTrips,
  clientRef,
  eventRef,
  periodStart,
  periodEnd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pendingTrips: TripEntity[]
  clientRef: string
  eventRef: string
  periodStart: string
  periodEnd: string
}) {
  const createInvoice = useInvoicesControllerCreate()

  const confirm = async () => {
    try {
      const invoice = await createInvoice.mutateAsync({
        data: {
          tripRefs: pendingTrips.map((t) => t.ref),
          clientRef: clientRef || undefined,
          eventRef: eventRef || undefined,
          periodStart: periodStart || undefined,
          periodEnd: periodEnd || undefined,
        },
      })
      toast.success(`Invoice ${invoice.ref} created.`)
      void queryClient.invalidateQueries({ queryKey: getTripsControllerListQueryKey() })
      void queryClient.invalidateQueries({ queryKey: getInvoicesControllerListQueryKey() })
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error creating the invoice.'))
    } finally {
      onOpenChange(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to invoice these rides?</AlertDialogTitle>
          <AlertDialogDescription>
            {pendingTrips.length} trip(s) will be grouped into one invoice and marked as invoiced. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>No</AlertDialogCancel>
          <AlertDialogAction disabled={createInvoice.isPending} onClick={() => void confirm()}>
            Yes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
