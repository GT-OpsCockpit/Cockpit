import { useState } from 'react'
import { Plus } from 'lucide-react'
import { getUsersControllerListQueryKey, useUsersControllerCreate } from '@cockpit/shared/api'
import { useRecordForm } from '@/lib/use-record-form'
import { RecordFormDialog } from '@/components/record-form-dialog'
import { Button } from '@/components/ui/button'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { UserFormFields } from './user-form-fields'
import { userCreateFormDefaults, userCreateFormSchema, type UserCreateFormValues } from './user-form-schema'
import { toCreateUserDto } from './user-form-mapping'

export function UserCreateDialog() {
  const [open, setOpen] = useState(false)
  const createUser = useUsersControllerCreate()

  const record = useRecordForm<UserCreateFormValues, { email: string }>({
    schema: userCreateFormSchema,
    defaultValues: userCreateFormDefaults(),
    submit: (values) => createUser.mutateAsync({ data: toCreateUserDto(values) }),
    success: (user) => `User ${user.email} created.`,
    error: 'Error creating user.',
    invalidate: [getUsersControllerListQueryKey()],
    close: () => setOpen(false),
  })

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) record.reset()
  }

  return (
    <RecordFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New user"
      trigger={
        <Button>
          <Plus className="size-4" />
          New user
        </Button>
      }
      record={record}
      submitLabel="Create"
      contentClassName="sm:max-w-lg"
    >
      <UserFormFields form={record.form} />
      <FormField
        control={record.form.control}
        name="password"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Password</FormLabel>
            <FormControl>
              <Input type="password" autoComplete="new-password" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </RecordFormDialog>
  )
}
