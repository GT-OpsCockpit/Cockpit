import { useState } from 'react'
import { GripVertical, Pencil, Plus, X } from 'lucide-react'
import { formatPhoneDisplay, isValidEmail, isValidPhone } from '@cockpit/shared'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { EmailInput } from '@/components/email-input'
import { PhoneInput } from '@/components/phone-input'
import { ConfirmActionDialog } from '@/components/confirm-action-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export interface ContactValues {
  name: string
  phone: string
  email: string
}

export interface ListedContact extends ContactValues {
  id: string
}

const BLANK: ContactValues = { name: '', phone: '', email: '' }

/**
 * The list of a client's points of contact — numbered by their order, a pencil
 * per row that opens an edit popup, a cross that asks before removing — with
 * an "Add a contact" button that opens the same popup empty.
 *
 * It only shows and edits a list; where the list lives is the caller's: the
 * account's saved contacts (client-contacts-section.tsx), or the ones typed
 * into the New account form before the account exists to attach them to.
 * Each handler returns whether the change went through, so a popup stays open
 * on a failed write instead of losing what was typed.
 */
export function ClientContactsList({
  contacts,
  onSave,
  onRemove,
  onReorder,
  hint,
}: {
  contacts: ListedContact[]
  /** `id` is null when adding. */
  onSave: (id: string | null, values: ContactValues) => Promise<boolean>
  onRemove: (id: string) => Promise<boolean>
  onReorder: (orderedIds: string[]) => Promise<void>
  hint?: string
}) {
  // `editing` is a contact being edited, 'new' for the add popup, null = closed.
  const [editing, setEditing] = useState<ListedContact | 'new' | null>(null)
  const [removeTarget, setRemoveTarget] = useState<ListedContact | null>(null)
  const [removing, setRemoving] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const drop = (targetId: string) => {
    if (!dragId || dragId === targetId) return
    const ids = contacts.map((c) => c.id)
    const from = ids.indexOf(dragId)
    const to = ids.indexOf(targetId)
    if (from === -1 || to === -1) return
    ids.splice(to, 0, ...ids.splice(from, 1))
    void onReorder(ids)
  }

  const confirmRemove = async () => {
    if (!removeTarget) return
    setRemoving(true)
    const done = await onRemove(removeTarget.id)
    setRemoving(false)
    if (done) setRemoveTarget(null)
  }

  return (
    <div className="grid gap-3">
      <h3 className="text-sm font-medium">Points of contact</h3>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}

      {contacts.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead className="w-12">#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact, index) => (
              <TableRow
                key={contact.id}
                draggable
                onDragStart={() => setDragId(contact.id)}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (dragId && dragId !== contact.id) setDragOverId(contact.id)
                }}
                onDragLeave={() => setDragOverId((current) => (current === contact.id ? null : current))}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOverId(null)
                  drop(contact.id)
                  setDragId(null)
                }}
                onDragEnd={() => {
                  setDragId(null)
                  setDragOverId(null)
                }}
                className={cn(dragId === contact.id && 'opacity-50', dragOverId === contact.id && 'bg-accent')}
              >
                <TableCell className="cursor-grab text-muted-foreground active:cursor-grabbing">
                  <GripVertical className="size-3.5" aria-hidden="true" />
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">{index + 1}</TableCell>
                <TableCell className="text-xs font-medium">{contact.name}</TableCell>
                <TableCell className="text-xs">{formatPhoneDisplay(contact.phone) || '—'}</TableCell>
                <TableCell className="text-xs">{contact.email || '—'}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${contact.name}`}
                      title="Edit"
                      onClick={() => setEditing(contact)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${contact.name}`}
                      title="Remove"
                      onClick={() => setRemoveTarget(contact)}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {contacts.length > 1 && (
        <p className="text-muted-foreground text-xs">Drag a row to reorder — #1 is the default POC on a new booking.</p>
      )}

      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setEditing('new')}>
        <Plus className="size-3.5" />
        Add a contact
      </Button>

      <ContactDialog
        // Remounted per contact so each popup opens on its own values.
        key={editing === null ? 'closed' : editing === 'new' ? 'new' : editing.id}
        contact={editing === 'new' ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSave={onSave}
      />

      <ConfirmActionDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title="Remove this contact?"
        description={removeTarget ? `${removeTarget.name} will no longer be listed for this account.` : ''}
        confirmLabel="Remove"
        pending={removing}
        onConfirm={confirmRemove}
      />
    </div>
  )
}

function ContactDialog({
  contact,
  open,
  onClose,
  onSave,
}: {
  contact: ListedContact | null
  open: boolean
  onClose: () => void
  onSave: (id: string | null, values: ContactValues) => Promise<boolean>
}) {
  const [values, setValues] = useState<ContactValues>(
    contact ? { name: contact.name, phone: contact.phone, email: contact.email } : BLANK,
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    const trimmed = {
      name: values.name.trim(),
      phone: values.phone.trim(),
      email: values.email.trim(),
    }
    if (!trimmed.name) return setError('Name is required.')
    if (trimmed.phone && !isValidPhone(trimmed.phone)) return setError('Enter a valid phone number, including its country code.')
    if (trimmed.email && !isValidEmail(trimmed.email)) return setError('Enter a valid email address.')
    setError(null)
    setSaving(true)
    const done = await onSave(contact?.id ?? null, trimmed)
    setSaving(false)
    if (done) onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{contact ? 'Edit contact' : 'Add a contact'}</DialogTitle>
        </DialogHeader>
        {/* This popup is opened from inside another form (New account): React
            carries a submit up through the portal to that outer form, which
            would then submit the whole account. Stopped here. */}
        <form
          className="grid gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void submit()
          }}
        >
          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Full name</label>
            <Input
              autoFocus
              placeholder="Full name"
              value={values.name}
              onChange={(e) => setValues({ ...values, name: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Mobile</label>
            <PhoneInput value={values.phone} onChange={(phone) => setValues({ ...values, phone })} />
          </div>
          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Email</label>
            <EmailInput value={values.email} onChange={(email) => setValues({ ...values, email })} />
          </div>
          {error && <p className="text-destructive text-xs">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner />}
              {contact ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
