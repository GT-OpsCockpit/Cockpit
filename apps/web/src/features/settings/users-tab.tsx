import { useState } from 'react'
import { toast } from 'sonner'
import type { PublicUserEntity } from '@cockpit/shared/api'
import { getUsersControllerListQueryKey, useUsersControllerDeactivate, useUsersControllerList } from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { usePermission } from '@/features/auth/use-permission'
import { Card, CardContent } from '@/components/ui/card'
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
import { UserCreateDialog } from './user-create-dialog'
import { UserEditDialog } from './user-edit-dialog'
import { UsersTable } from './users-table'

export function UsersTab() {
  const [editTarget, setEditTarget] = useState<PublicUserEntity | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<PublicUserEntity | null>(null)

  const canManage = usePermission('user:manage')

  // UsersController is class-level @RequirePermission('user:manage') — GET
  // itself 403s for a DISPATCHER, so don't even fire the query.
  const users = useUsersControllerList({ query: { enabled: canManage } })
  const deactivateUser = useUsersControllerDeactivate()

  const handleDeactivate = async () => {
    if (!deactivateTarget) return
    try {
      await deactivateUser.mutateAsync({ id: deactivateTarget.id })
      toast.success(`User ${deactivateTarget.email} deactivated.`)
      void queryClient.invalidateQueries({ queryKey: getUsersControllerListQueryKey() })
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error deactivating user.'))
    } finally {
      setDeactivateTarget(null)
    }
  }

  if (!canManage) {
    return (
      <Card>
        <CardContent className="text-muted-foreground text-sm">Managing users requires the Admin role.</CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <UserCreateDialog />
      </div>

      <UsersTable
        users={users.data ?? []}
        onEdit={setEditTarget}
        onDeactivate={setDeactivateTarget}
        canManage={canManage}
      />

      <UserEditDialog user={editTarget} onOpenChange={(open) => !open && setEditTarget(null)} />

      <AlertDialog open={!!deactivateTarget} onOpenChange={(open) => !open && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate this user?</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateTarget &&
                `${deactivateTarget.firstName} ${deactivateTarget.lastName} (${deactivateTarget.email}) will no longer be able to log in. There is no way to reactivate a user account — this can't be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeactivate()}>Deactivate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
