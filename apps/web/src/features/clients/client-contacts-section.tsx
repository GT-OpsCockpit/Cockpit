import { useState } from 'react'
import { GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  useClientsControllerAddContact,
  useClientsControllerDeleteContact,
  useClientsControllerListContacts,
  useClientsControllerReorderContacts,
  useClientsControllerUpdateContact,
  type ClientContactEntity,
} from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmailInput } from '@/components/email-input'
import { PhoneInput } from '@/components/phone-input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ConfirmActionDialog } from '@/components/confirm-action-dialog'

interface DraftContact {
  id: string | null
  name: string
  phone: string
  email: string
}

const BLANK_DRAFT: DraftContact = { id: null, name: '', phone: '', email: '' }

/**
 * This client's own POCs, numbered 1..N by their chosen order — a company
 * account can have several (ops desk, a specific EA, a duty manager),
 * unlike the single pocName/pocPhone/pocEmail already on this form. The
 * first one here is what a new booking's own POC field auto-fills with by
 * default (trip-form-fields.tsx), on top of the free-text override it's
 * always kept — drag a row to change who that default is.
 */
export function ClientContactsSection({ clientRef }: { clientRef: string }) {
  const contacts = useClientsControllerListContacts(clientRef)
  const [draft, setDraft] = useState<DraftContact | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ClientContactEntity | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const addContact = useClientsControllerAddContact()
  const updateContact = useClientsControllerUpdateContact()
  const deleteContact = useClientsControllerDeleteContact()
  const reorderContacts = useClientsControllerReorderContacts()

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ['/api/clients', clientRef, 'contacts'] })

  const startEdit = (contact: ClientContactEntity) =>
    setDraft({ id: contact.id, name: contact.name, phone: contact.phone ?? '', email: contact.email ?? '' })

  const saveDraft = async () => {
    if (!draft) return
    if (!draft.name.trim()) {
      toast.error('Name is required.')
      return
    }
    const data = {
      name: draft.name.trim(),
      phone: draft.phone.trim() || undefined,
      email: draft.email.trim() || undefined,
    }
    try {
      if (draft.id) {
        await updateContact.mutateAsync({ ref: clientRef, contactId: draft.id, data })
        toast.success('Contact updated.')
      } else {
        await addContact.mutateAsync({ ref: clientRef, data })
        toast.success('Contact added.')
      }
      setDraft(null)
      invalidate()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error saving contact.'))
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteContact.mutateAsync({ ref: clientRef, contactId: deleteTarget.id })
      toast.success('Contact removed.')
      setDeleteTarget(null)
      invalidate()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error removing contact.'))
    }
  }

  // Native HTML5 drag-and-drop rather than a new dependency — dropping row
  // A onto row B moves A to sit right where B was, the rest sliding over to
  // make room, same as any reorderable list. Applied optimistically to the
  // cached list first so the row doesn't snap back while the request is in
  // flight, then reconciled with whatever the server actually saved.
  const reorder = async (draggedId: string, targetId: string) => {
    const list = contacts.data ?? []
    const from = list.findIndex((c) => c.id === draggedId)
    const to = list.findIndex((c) => c.id === targetId)
    if (from === -1 || to === -1 || from === to) return
    const reordered = [...list]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)

    queryClient.setQueryData(['/api/clients', clientRef, 'contacts'], reordered)
    try {
      await reorderContacts.mutateAsync({ ref: clientRef, data: { contactIds: reordered.map((c) => c.id) } })
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error saving the new order.'))
    } finally {
      invalidate()
    }
  }

  const saving = addContact.isPending || updateContact.isPending
  const list = contacts.data ?? []

  return (
    <div className="grid gap-3">
      <h3 className="text-sm font-medium">Points of contact</h3>

      {list.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead className="w-12">#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((contact, index) => (
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
                  if (dragId) void reorder(dragId, contact.id)
                  setDragId(null)
                }}
                onDragEnd={() => {
                  setDragId(null)
                  setDragOverId(null)
                }}
                className={cn(
                  dragId === contact.id && 'opacity-50',
                  dragOverId === contact.id && 'bg-accent',
                )}
              >
                <TableCell className="cursor-grab text-muted-foreground active:cursor-grabbing">
                  <GripVertical className="size-3.5" aria-hidden="true" />
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">{index + 1}</TableCell>
                <TableCell className="text-xs font-medium">{contact.name}</TableCell>
                <TableCell className="text-xs">{contact.phone ?? '—'}</TableCell>
                <TableCell className="text-xs">{contact.email ?? '—'}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button type="button" variant="ghost" size="icon" onClick={() => startEdit(contact)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setDeleteTarget(contact)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {list.length > 1 && <p className="text-muted-foreground text-xs">Drag a row to reorder — #1 is the default POC on a new booking.</p>}

      {draft ? (
        // Wider than the compact table row above and each field labeled —
        // "Full name" / "Mobile" / "Email" are not obvious from a bare
        // placeholder alone once the box has room to spare.
        <div className="grid gap-3 rounded-md border p-4 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Full name</label>
            <Input
              placeholder="Full name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Mobile</label>
            <PhoneInput value={draft.phone} onChange={(v) => setDraft({ ...draft, phone: v })} />
          </div>
          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Email</label>
            <EmailInput value={draft.email} onChange={(v) => setDraft({ ...draft, email: v })} />
          </div>
          <div className="flex gap-2 sm:col-span-3">
            <Button type="button" size="sm" onClick={() => void saveDraft()} disabled={saving}>
              {draft.id ? 'Save' : 'Add'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(null)}>
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setDraft(BLANK_DRAFT)}>
          <Plus className="size-3.5" />
          Add a contact
        </Button>
      )}

      <ConfirmActionDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Remove this contact?"
        description={deleteTarget ? `${deleteTarget.name} will no longer be listed for this account.` : ''}
        confirmLabel="Remove"
        pending={deleteContact.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
