import { Pencil, UserCog, X } from 'lucide-react'
import type { PublicUserEntity } from '@cockpit/shared/api'
import { formatPhoneDisplay } from '@cockpit/shared'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/table-card'
import { EmptyState } from '@/components/empty-state'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString()
}

interface UsersTableProps {
  users: PublicUserEntity[]
  onEdit: (user: PublicUserEntity) => void
  onDeactivate: (user: PublicUserEntity) => void
  /** UX-layer mirror of user:manage (see docs/agents/permissions.md) — the whole table is read-only without it. */
  canManage: boolean
}

export function UsersTable({ users, onEdit, onDeactivate, canManage }: UsersTableProps) {
  return (
    <TableCard>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ref</TableHead>
            <TableHead>Surname</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Mobile</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Activated</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="p-0 whitespace-normal">
                <EmptyState icon={UserCog} title="No records to display" description="Users added to Cockpit will appear here." />
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
              <TableRow key={user.id} className={cn(!user.active && 'opacity-50')}>
                <TableCell className="text-xs font-medium">{user.id.slice(0, 8)}</TableCell>
                <TableCell className="text-xs">{user.firstName}</TableCell>
                <TableCell className="text-xs">{user.lastName}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{formatPhoneDisplay(user.phone) || '—'}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{user.email}</TableCell>
                <TableCell className="text-xs">{user.role}</TableCell>
                <TableCell className="text-xs">
                  <div>{formatDate(user.createdAt)}</div>
                  {user.deactivatedAt && (
                    <div className="text-destructive text-[10px]">Deactivated {formatDate(user.deactivatedAt)}</div>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Edit"
                      disabled={!user.active || !canManage}
                      onClick={() => onEdit(user)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Deactivate"
                      disabled={!user.active || !canManage}
                      onClick={() => onDeactivate(user)}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableCard>
  )
}
