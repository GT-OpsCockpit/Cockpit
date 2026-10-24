import {
  getPriceListsControllerGetQueryKey,
  priceListsControllerListQueryKeyPrefix,
  usePriceListsControllerDelete,
  usePriceListsControllerGet,
  usePriceListsControllerUpdate,
} from '@cockpit/shared/api'
import { useRecordForm } from '@/lib/use-record-form'
import { RecordFormDialog } from '@/components/record-form-dialog'
import { PermanentDeleteAction } from '@/components/permanent-delete-action'
import { PriceListFormFields } from './price-list-form-fields'
import { PriceListEntriesSection } from './price-list-entries-section'
import { PriceListClientsSection } from './price-list-clients-section'
import { priceListFormDefaults, priceListFormSchema, type PriceListFormValues } from './price-list-form-schema'
import { priceListToFormValues, toUpdatePriceListDto } from './price-list-form-mapping'

/** Fetches the price list fresh by ref — see PassengerEditDialog's identical
 * comment for why a row snapshot from the table isn't good enough once an
 * entry or a client gets added underneath it. */
export function PriceListEditDialog({
  priceListRef,
  onOpenChange,
}: {
  priceListRef: string | null
  onOpenChange: (open: boolean) => void
}) {
  const priceListQuery = usePriceListsControllerGet(priceListRef ?? '', {
    query: { enabled: !!priceListRef },
  })
  const priceList = priceListQuery.data

  const updatePriceList = usePriceListsControllerUpdate()
  const deletePriceList = usePriceListsControllerDelete()

  const record = useRecordForm<PriceListFormValues, unknown>({
    schema: priceListFormSchema,
    values: priceList ? priceListToFormValues(priceList) : priceListFormDefaults(),
    submit: (values) => updatePriceList.mutateAsync({ ref: priceList!.ref, data: toUpdatePriceListDto(values) }),
    success: () => `Price list ${priceList?.ref} updated.`,
    error: 'Error updating price list.',
    invalidate: [priceListsControllerListQueryKeyPrefix, ...(priceListRef ? [getPriceListsControllerGetQueryKey(priceListRef)] : [])],
    close: () => onOpenChange(false),
    disabled: !priceList,
  })

  return (
    <RecordFormDialog
      open={!!priceListRef}
      onOpenChange={onOpenChange}
      title={`Edit price list${priceList ? ` — ${priceList.ref}` : ''}`}
      record={record}
      layout="scroll-body"
      contentClassName="sm:max-w-6xl"
      actions={
        priceList && (
          <PermanentDeleteAction
            label={`price list ${priceList.ref}`}
            description={`${priceList.name} and every route it prices will be removed for good, and unlinked from any client using it.`}
            onDelete={() => deletePriceList.mutateAsync({ ref: priceList.ref })}
            invalidateKey={priceListsControllerListQueryKeyPrefix}
            onDeleted={() => onOpenChange(false)}
          />
        )
      }
    >
      <PriceListFormFields form={record.form} />
      {priceList && (
        <>
          <div className="border-t" />
          <PriceListEntriesSection priceList={priceList} />
          <div className="border-t" />
          <PriceListClientsSection priceList={priceList} />
        </>
      )}
    </RecordFormDialog>
  )
}
