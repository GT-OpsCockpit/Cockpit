import type { ReactNode } from 'react'
import type { FieldValues } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Form } from '@/components/ui/form'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { RecordForm } from '@/lib/use-record-form'

/**
 * The dialog every record form in the app is wrapped in: a title, the fields,
 * then Cancel and a submit button that spins while the write is in flight.
 *
 * Callers own the fields and the wording; this owns the chrome, so the six
 * dialog primitives are wired up one way in one place instead of once per
 * record — same division as ConfirmActionDialog.
 */
export function RecordFormDialog<TValues extends FieldValues>({
  open,
  onOpenChange,
  title,
  trigger,
  record,
  submitLabel = 'Confirm',
  submitIcon,
  submitDisabled = false,
  contentClassName = 'sm:max-w-3xl',
  layout = 'plain',
  actions,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  /** The button that opens it, for the dialogs that own their own open state. */
  trigger?: ReactNode
  /** Only what the chrome renders — the dialogs that own their own submit pass a literal. */
  record: Pick<RecordForm<TValues>, 'form' | 'onSubmit' | 'isSubmitting'>
  submitLabel?: ReactNode
  /** Shown on the submit button while idle — the spinner takes its place mid-write. */
  submitIcon?: ReactNode
  /** Greys out the submit button — a permission lockout, or an incomplete state. */
  submitDisabled?: boolean
  contentClassName?: string
  /**
   * `plain` scrolls the whole dialog. `scroll-body` scrolls only the fields, so
   * the title and the buttons stay put — what the long booking forms need, where
   * the submit button would otherwise sit below an ASD + sub-contracted + flight
   * block.
   */
  layout?: 'plain' | 'scroll-body'
  /** Extra buttons in the footer, before Cancel/submit (e.g. "Create & Dispatch"). */
  actions?: ReactNode
  children: ReactNode
}) {
  const scrolls = layout === 'scroll-body'
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className={
          scrolls
            ? `flex max-h-[90vh] flex-col overflow-hidden ${contentClassName}`
            : `max-h-[90vh] overflow-y-auto ${contentClassName}`
        }
      >
        <DialogHeader className={scrolls ? 'shrink-0' : undefined}>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Form {...record.form}>
          <form
            className={scrolls ? 'flex min-h-0 flex-1 flex-col gap-4' : 'grid gap-4'}
            onSubmit={record.onSubmit}
          >
            {scrolls ? (
              // `px-2` is not decoration: it absorbs both the focus ring an edge
              // field would otherwise have clipped, and the ~7px an InputGroup's
              // trailing button overhangs by (`has-[>button]:mr-[-0.45rem]` in
              // ui/input-group.tsx) — which lands in the padding instead of
              // turning into a horizontal scrollbar. `-mx-2` gives it back, so
              // the fields stay flush with the title and the buttons.
              <div className="-mx-2 min-h-0 flex-1 overflow-y-auto px-2">{children}</div>
            ) : (
              children
            )}
            <DialogFooter className={scrolls ? 'shrink-0' : undefined}>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={record.isSubmitting || submitDisabled}>
                {record.isSubmitting ? <Spinner /> : submitIcon}
                {submitLabel}
              </Button>
              {actions}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
