import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Lock } from 'lucide-react'
import { useCompanyControllerGet, useCompanyControllerUpdate } from '@cockpit/shared/api'
import { getApiErrorMessage } from '@/lib/api-error'
import { usePermission } from '@/features/auth/use-permission'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form } from '@/components/ui/form'
import { CompanyFormFields } from './company-form-fields'
import { companyFormDefaults, companyFormSchema, type CompanyFormValues } from './company-form-schema'
import { toUpdateCompanyInfoDto } from './company-form-mapping'

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

  if (company.data?.saved) {
    return (
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Company info</CardTitle>
          <Badge variant="secondary" className="gap-1">
            <Lock className="size-3" />
            Locked
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-muted-foreground text-sm">
            Company info can only be set once and can't be edited afterwards.
          </p>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            {COMPANY_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <dt className="text-muted-foreground text-xs">{label}</dt>
                <dd className="text-sm">{company.data[key] || '—'}</dd>
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
        <p className="text-muted-foreground mb-4 text-sm">
          All fields are required. Once saved, company info can't be edited — double check before submitting.
        </p>
        <Form {...form}>
          <form className="grid gap-4" onSubmit={onSubmit}>
            <CompanyFormFields form={form} />
            <div className="flex justify-end">
              <Button type="submit" disabled={updateCompany.isPending}>
                Save
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
