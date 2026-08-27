import type { FieldValues, Path, UseFormReturn } from 'react-hook-form'
import { CreateUserDtoRole } from '@cockpit/shared/api'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

interface CommonUserFields {
  email: string
  role: CreateUserDtoRole
  firstName: string
  lastName: string
  phone?: string
}

/**
 * The fields shared by create and edit (email/role/surname/name/phone).
 * Password is create-only — UpdateUserDto has no password field — so it's
 * rendered directly in user-create-dialog.tsx instead of here.
 */
export function UserFormFields<T extends CommonUserFields & FieldValues>({
  form,
  disabled = false,
}: {
  form: UseFormReturn<T>
  disabled?: boolean
}) {
  return (
    <fieldset disabled={disabled} className="contents">
      <div className="grid gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name={'firstName' as Path<T>}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Surname</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={'lastName' as Path<T>}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name={'email' as Path<T>}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={'phone' as Path<T>}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mobile</FormLabel>
                <FormControl>
                  <Input placeholder="+33…" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name={'role' as Path<T>}
          render={({ field }) => (
            <FormItem className="max-w-xs">
              <FormLabel>Role</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={CreateUserDtoRole.DISPATCHER}>Dispatch</SelectItem>
                  <SelectItem value={CreateUserDtoRole.ADMIN}>Admin</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </fieldset>
  )
}
