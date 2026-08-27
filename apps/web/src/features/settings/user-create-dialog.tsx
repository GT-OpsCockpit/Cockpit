import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { getUsersControllerListQueryKey, useUsersControllerCreate } from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { UserFormFields } from './user-form-fields'
import { userCreateFormDefaults, userCreateFormSchema, type UserCreateFormValues } from './user-form-schema'
import { toCreateUserDto } from './user-form-mapping'

export function UserCreateDialog() {
  const [open, setOpen] = useState(false)

  const form = useForm<UserCreateFormValues>({
    resolver: zodResolver(userCreateFormSchema),
    defaultValues: userCreateFormDefaults(),
  })

  const createUser = useUsersControllerCreate()

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) form.reset(userCreateFormDefaults())
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const user = await createUser.mutateAsync({ data: toCreateUserDto(values) })
      toast.success(`User ${user.email} created.`)
      onOpenChange(false)
      void queryClient.invalidateQueries({ queryKey: getUsersControllerListQueryKey() })
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error creating user.'))
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          New user
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New user</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="grid gap-4" onSubmit={onSubmit}>
            <UserFormFields form={form} />
            <FormField
              control={form.control}
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createUser.isPending}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
