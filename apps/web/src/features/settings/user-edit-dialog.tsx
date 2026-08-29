import type { PublicUserEntity } from '@cockpit/shared/api'
import { getUsersControllerListQueryKey, useUsersControllerUpdate } from '@cockpit/shared/api'
import { useRecordForm } from '@/lib/use-record-form'
import { RecordFormDialog } from '@/components/record-form-dialog'
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
  const updateUser = useUsersControllerUpdate()

  const record = useRecordForm<UserEditFormValues, unknown>({
    schema: userEditFormSchema,
    values: user ? userToFormValues(user) : EMPTY_DEFAULTS,
    submit: (values) => updateUser.mutateAsync({ id: user!.id, data: toUpdateUserDto(values) }),
    success: () => `User ${user?.email} updated.`,
    error: 'Error updating user.',
    invalidate: [getUsersControllerListQueryKey()],
    close: () => onOpenChange(false),
    disabled: !user,
  })

  return (
    <RecordFormDialog
      open={!!user}
      onOpenChange={onOpenChange}
      title={`Edit user${user ? ` — ${user.email}` : ''}`}
      record={record}
      contentClassName="sm:max-w-lg"
    >
      <UserFormFields form={record.form} />
    </RecordFormDialog>
  )
}
