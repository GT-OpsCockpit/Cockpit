import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import type { PublicUserEntity } from '@cockpit/shared/api'
import { useUsersControllerSetPassword } from '@cockpit/shared/api'
import { getApiErrorMessage } from '@/lib/api-error'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const MIN_LENGTH = 8

// Mirrors the API's @MinLength(8) on CreateUserDto / SetPasswordDto.
const passwordSchema = z.object({
  password: z.string().min(MIN_LENGTH, `Password must be at least ${MIN_LENGTH} characters.`),
})

/**
 * Sets a new password for someone else's account.
 *
 * v2 gives each account its own password, which the legacy's access records
 * had no notion of — and deactivation here is one-way. Without this, an
 * account whose password is lost has no way back in and no way to be retired
 * cleanly. Sessions the account already holds stay valid: this exists to let
 * someone back in, not to evict them (that is Deactivate).
 */
export function UserPasswordDialog({
  user,
  onOpenChange,
}: {
  user: PublicUserEntity | null
  onOpenChange: (open: boolean) => void
}) {
  const form = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '' },
  })
  const setUserPassword = useUsersControllerSetPassword()

  // A password typed for one account must not be sitting there when the dialog
  // reopens on another.
  useEffect(() => {
    if (user) form.reset({ password: '' })
  }, [user, form])

  const close = (open: boolean) => {
    if (!open) form.reset({ password: '' })
    onOpenChange(open)
  }

  const onSubmit = form.handleSubmit(async (values) => {
    if (!user) return
    try {
      await setUserPassword.mutateAsync({ id: user.id, data: { password: values.password } })
      toast.success(`New password set for ${user.email}.`)
      close(false)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error setting the password.'))
    }
  })

  return (
    <Dialog open={!!user} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set a new password</DialogTitle>
          <DialogDescription>
            {user
              ? `${user.firstName} ${user.lastName} (${user.email}) will sign in with this password from now on. Their current sessions stay open.`
              : null}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={setUserPassword.isPending}>
                {setUserPassword.isPending && <Spinner />}
                Set password
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
