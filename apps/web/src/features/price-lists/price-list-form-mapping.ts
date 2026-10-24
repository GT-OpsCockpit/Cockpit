import type { CreatePriceListDto, PriceListEntity, UpdatePriceListDto } from '@cockpit/shared/api'
import type { PriceListFormValues } from './price-list-form-schema'

export function priceListToFormValues(priceList: PriceListEntity): PriceListFormValues {
  return {
    name: priceList.name,
    active: priceList.active,
  }
}

export function toCreatePriceListDto(values: PriceListFormValues): CreatePriceListDto {
  return {
    name: values.name,
    active: values.active,
  }
}

export function toUpdatePriceListDto(values: PriceListFormValues): UpdatePriceListDto {
  return {
    name: values.name,
    active: values.active,
  }
}
