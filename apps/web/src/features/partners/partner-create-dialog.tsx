import { useState } from 'react'
import { Plus } from 'lucide-react'
import { getPartnersControllerListQueryKey, usePartnersControllerCreate } from '@cockpit/shared/api'
import { useRecordForm } from '@/lib/use-record-form'
import { RecordFormDialog } from '@/components/record-form-dialog'
import { Button } from '@/components/ui/button'
import { PartnerFormFields } from './partner-form-fields'
import { partnerFormDefaults, partnerFormSchema, type PartnerFormValues } from './partner-form-schema'
import { toCreatePartnerDto } from './partner-form-mapping'

export function PartnerCreateDialog() {
  const [open, setOpen] = useState(false)
  const createPartner = usePartnersControllerCreate()

  const record = useRecordForm<PartnerFormValues, unknown>({
    schema: partnerFormSchema,
    defaultValues: partnerFormDefaults(),
    submit: (values) => createPartner.mutateAsync({ data: toCreatePartnerDto(values) }),
    success: () => 'Partner created.',
    error: 'Error creating partner.',
    invalidate: [getPartnersControllerListQueryKey()],
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
      title="New partner"
      trigger={
        <Button>
          <Plus className="size-4" />
          New partner
        </Button>
      }
      record={record}
      submitLabel="Create partner"
      contentClassName="sm:max-w-2xl"
      layout="scroll-body"
    >
      <PartnerFormFields form={record.form} />
    </RecordFormDialog>
  )
}
