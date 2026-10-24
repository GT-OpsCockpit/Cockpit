import { useState } from 'react'
import { Plus } from 'lucide-react'
import { priceListsControllerListQueryKeyPrefix, usePriceListsControllerCreate } from '@cockpit/shared/api'
import { useRecordForm } from '@/lib/use-record-form'
import { RecordFormDialog } from '@/components/record-form-dialog'
import { Button } from '@/components/ui/button'
import { PriceListFormFields } from './price-list-form-fields'
import { priceListFormDefaults, priceListFormSchema, type PriceListFormValues } from './price-list-form-schema'
import { toCreatePriceListDto } from './price-list-form-mapping'

export function PriceListCreateDialog() {
  const [open, setOpen] = useState(false)
  const createPriceList = usePriceListsControllerCreate()

  const record = useRecordForm<PriceListFormValues, unknown>({
    schema: priceListFormSchema,
    defaultValues: priceListFormDefaults(),
    submit: (values) => createPriceList.mutateAsync({ data: toCreatePriceListDto(values) }),
    success: () => 'Price list created.',
    error: 'Error creating price list.',
    invalidate: [priceListsControllerListQueryKeyPrefix],
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
      title="New price list"
      trigger={
        <Button>
          <Plus className="size-4" />
          New price list
        </Button>
      }
      record={record}
      submitLabel="Create"
    >
      <PriceListFormFields form={record.form} />
    </RecordFormDialog>
  )
}
