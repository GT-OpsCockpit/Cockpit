import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Pencil } from 'lucide-react'
import { useCompanyControllerGet, useCompanyControllerUpdate } from '@cockpit/shared/api'
import { getApiErrorMessage } from '@/lib/api-error'
import { usePermission } from '@/features/auth/use-permission'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form } from '@/components/ui/form'
import { CompanyFormFields } from './company-form-fields'
import { companyFormDefaults, companyFormSchema, type CompanyFormValues } from './company-form-schema'
import { companyInfoToFormValues, toUpdateCompanyInfoDto } from './company-form-mapping'

const COMPANY_FIELDS: { key: keyof CompanyFormValues; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'legalName', label: 'Legal name' },
  { key: 'street1', label: 'Street' },
  { key: 'zipCode', label: 'Zip code' },
  { key: 'city', label: 'City' },
  { key: 'countryCode', label: 'Country' },
  { key: 'vatNbr', label: 'VAT number' },
  { key: 'email', label: 'Email' },
  { key: 'website', label: 'Website' },
  { key: 'ownerSurname', label: 'Owner surname' },
  { key: 'ownerName', label: 'Owner name' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'ownerEmail', label: 'Owner email' },
]

export function CompanyTab() {
  const canEdit = usePermission('company:edit')
  // Once saved, the sheet shows read-only until the pencil re-opens it —
  // the legacy's own flow (owner.html:269-280), where editing was always
  // possible behind the Owner password. `saved` marks "filled in at least
  // once", never a permanent lock.
  const [editing, setEditing] = useState(false)

  // CompanyController is class-level @RequirePermission('company:edit') —
  // GET itself 403s for a DISPATCHER, so don't even fire the query (see
  // docs/agents/permissions.md and the plan this feature followed).
  const company = useCompanyControllerGet({ query: { enabled: canEdit } })
  const updateCompany = useCompanyControllerUpdate()

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: companyFormDefaults(),
  })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await updateCompany.mutateAsync({ data: toUpdateCompanyInfoDto(values) })
      toast.success('Company info saved.')
      setEditing(false)
      void company.refetch()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error saving company info.'))
    }
  })

  if (!canEdit) {
    return (
      <Card>
        <CardContent className="text-muted-foreground text-sm">Viewing company info requires the Admin role.</CardContent>
      </Card>
    )
  }

  if (company.isLoading) return null

  const saved = company.data
  if (saved?.saved && !editing) {
    return (
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Company info</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            title="Edit company info"
            onClick={() => {
              form.reset(companyInfoToFormValues(saved))
              setEditing(true)
            }}
          >
            <Pencil className="size-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            {COMPANY_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <dt className="text-muted-foreground text-xs">{label}</dt>
                <dd className="text-sm">{saved[key] || '—'}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company info</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-4 text-sm">All fields are required.</p>
        <Form {...form}>
          <form className="grid gap-4" onSubmit={onSubmit}>
            <CompanyFormFields form={form} />
            <div className="flex justify-end gap-2">
              {editing && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    form.reset(companyFormDefaults())
                    setEditing(false)
                  }}
                >
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={updateCompany.isPending}>
                {updateCompany.isPending && <Spinner />}
                Save
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
