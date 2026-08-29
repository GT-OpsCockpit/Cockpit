import { useState } from 'react'
import { toast } from 'sonner'
import type { PublicUserEntity } from '@cockpit/shared/api'
import { useUsersControllerSetPassword } from '@cockpit/shared/api'
import { getApiErrorMessage } from '@/lib/api-error'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const MIN_LENGTH = 8

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
  const [password, setPassword] = useState('')
  const setUserPassword = useUsersControllerSetPassword()

  const close = (open: boolean) => {
    if (!open) setPassword('')
    onOpenChange(open)
  }

  const tooShort = password.length > 0 && password.length < MIN_LENGTH

  const submit = async () => {
    if (!user || password.length < MIN_LENGTH) return
    try {
      await setUserPassword.mutateAsync({ id: user.id, data: { password } })
      toast.success(`New password set for ${user.email}.`)
      close(false)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error setting the password.'))
    }
  }

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
        <div className="grid gap-2">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {tooShort && <p className="text-destructive text-xs">Password must be at least {MIN_LENGTH} characters.</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={password.length < MIN_LENGTH || setUserPassword.isPending}
            onClick={() => void submit()}
          >
            {setUserPassword.isPending && <Spinner />}
            Set password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
