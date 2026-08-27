import type { UpdateCompanyInfoDto } from '@cockpit/shared/api'
import type { CompanyFormValues } from './company-form-schema'

/** No entity→form direction — once `saved` is true the API locks writes forever, so there's no edit-prefill case (see company-tab.tsx). */
export function toUpdateCompanyInfoDto(values: CompanyFormValues): UpdateCompanyInfoDto {
  return values
}
