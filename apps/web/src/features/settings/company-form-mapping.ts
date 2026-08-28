import type { CompanyInfoEntity, UpdateCompanyInfoDto } from '@cockpit/shared/api'
import { companyFormDefaults, type CompanyFormValues } from './company-form-schema'

export function toUpdateCompanyInfoDto(values: CompanyFormValues): UpdateCompanyInfoDto {
  return values
}

/** Prefills the edit form from the saved sheet — every field is required, so a missing one falls back to empty rather than being dropped. */
export function companyInfoToFormValues(info: CompanyInfoEntity): CompanyFormValues {
  const defaults = companyFormDefaults()
  return Object.fromEntries(
    Object.keys(defaults).map((key) => [key, info[key as keyof CompanyFormValues] ?? '']),
  ) as CompanyFormValues
}
