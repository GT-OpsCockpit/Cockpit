import type { PartnerEntity } from '@cockpit/shared/api'
import { getPartnersControllerListQueryKey, usePartnersControllerDelete, usePartnersControllerUpdate } from '@cockpit/shared/api'
import { useRecordForm } from '@/lib/use-record-form'
import { RecordFormDialog } from '@/components/record-form-dialog'
import { PermanentDeleteAction } from '@/components/permanent-delete-action'
import { PartnerFormFields } from './partner-form-fields'
import { partnerEditFormSchema, type PartnerFormValues } from './partner-form-schema'
import { partnerToFormValues, toUpdatePartnerDto } from './partner-form-mapping'

export function PartnerEditDialog({
  partner,
  onOpenChange,
}: {
  partner: PartnerEntity | null
  onOpenChange: (open: boolean) => void
}) {
  const updatePartner = usePartnersControllerUpdate()
  const deletePartner = usePartnersControllerDelete()

  const record = useRecordForm<PartnerFormValues, unknown>({
    schema: partnerEditFormSchema,
    values: partner ? partnerToFormValues(partner) : undefined,
    submit: (values) => updatePartner.mutateAsync({ ref: partner!.ref, data: toUpdatePartnerDto(values) }),
    success: () => `Partner ${partner?.ref} updated.`,
    error: 'Error updating partner.',
    invalidate: [getPartnersControllerListQueryKey()],
    close: () => onOpenChange(false),
    disabled: !partner,
  })

  return (
    <RecordFormDialog
      open={!!partner}
      onOpenChange={onOpenChange}
      title={`Edit partner${partner ? ` — ${partner.ref}` : ''}`}
      record={record}
      contentClassName="sm:max-w-2xl"
      actions={
        partner && (
          <PermanentDeleteAction
            label={`partner ${partner.ref}`}
            description={`${partner.companyName ?? partner.contactName} will be removed for good, along with its own roster links. Deactivating keeps its history — this does not.`}
            onDelete={() => deletePartner.mutateAsync({ ref: partner.ref })}
            invalidateKey={getPartnersControllerListQueryKey()}
            onDeleted={() => onOpenChange(false)}
          />
        )
      }
    >
      <PartnerFormFields form={record.form} editing />
    </RecordFormDialog>
  )
}
