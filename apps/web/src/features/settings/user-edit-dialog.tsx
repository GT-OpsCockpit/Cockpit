import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import type { PublicUserEntity } from '@cockpit/shared/api'
import { getUsersControllerListQueryKey, useUsersControllerUpdate } from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Form } from '@/components/ui/form'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { UserFormFields } from './user-form-fields'
import { userEditFormSchema, type UserEditFormValues } from './user-form-schema'
import { userToFormValues, toUpdateUserDto } from './user-form-mapping'

const EMPTY_DEFAULTS: UserEditFormValues = { email: '', role: 'DISPATCHER', firstName: '', lastName: '', phone: '' }

export function UserEditDialog({
  user,
  onOpenChange,
}: {
  user: PublicUserEntity | null
  onOpenChange: (open: boolean) => void
}) {
  const form = useForm<UserEditFormValues>({
    resolver: zodResolver(userEditFormSchema),
    values: user ? userToFormValues(user) : EMPTY_DEFAULTS,
  })

  const updateUser = useUsersControllerUpdate()

  const onSubmit = form.handleSubmit(async (values) => {
    if (!user) return
    try {
      await updateUser.mutateAsync({ id: user.id, data: toUpdateUserDto(values) })
      toast.success(`User ${user.email} updated.`)
      onOpenChange(false)
      void queryClient.invalidateQueries({ queryKey: getUsersControllerListQueryKey() })
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error updating user.'))
    }
  })

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit user{user ? ` — ${user.email}` : ''}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="grid gap-4" onSubmit={onSubmit}>
            <UserFormFields form={form} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateUser.isPending}>
                {updateUser.isPending && <Spinner />}
                Confirm
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
