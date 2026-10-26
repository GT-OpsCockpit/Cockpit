import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  getPartnersControllerListQueryKey,
  useMetaControllerGetMeta,
  usePartnersControllerList,
  usePartnersControllerSetActive,
} from '@cockpit/shared/api'
import type { PartnerEntity } from '@cockpit/shared/api'
import { Building2, Pencil, RotateCcw, X } from 'lucide-react'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/table-card'
import { TableSkeletonRows } from '@/components/table-skeleton-rows'
import { EmptyState } from '@/components/empty-state'
import { FilterCard } from '@/components/filter-card'
import { FilterField } from '@/components/filter-field'
import { SearchCombobox } from '@/components/search-combobox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CountryLabel } from '@/components/country-label'
import { useCountryOptions } from '@/hooks/use-country-options'
import { PartnerEditDialog } from './partner-edit-dialog'

const ALL_CATEGORY = '__all__'
const COLUMN_COUNT = 8

/**
 * Real Partner companies/individuals (the new, structured Partner entity —
 * see docs/feature-requests/partner-companies.md), shown alongside the
 * existing Drivers table's own legacy "Partners" grouping (a driver record
 * carrying a free-text Company). The two will converge once every partner
 * driver/vehicle has been attached to one of these.
 *
 * Company details only — one row per Partner, same shape as the Drivers
 * table above it. The driver/vehicle roster attached to a partner is
 * managed from the Drivers and Fleet pages themselves, not duplicated here.
 */
interface PartnerListFilters {
  countryCode: string
  area: string
  model: string
  category: string
  showInactive: boolean
}

const defaultPartnerListFilters = (): PartnerListFilters => ({
  countryCode: '',
  area: '',
  model: '',
  category: '',
  showInactive: false,
})

/** A partner's own vehicle(s) — its roster for a company, its single car for an individual. */
function partnerModels(partner: PartnerEntity): string[] {
  return partner.fleetVehicles.map((v) => v.model)
}

function applyPartnerFilters(partners: PartnerEntity[], filters: PartnerListFilters): PartnerEntity[] {
  return partners
    .filter((p) => !filters.countryCode || p.countryCode === filters.countryCode)
    .filter((p) => !filters.area || p.area === filters.area)
    .filter((p) => !filters.model || partnerModels(p).includes(filters.model))
}

export function PartnersSection() {
  const [filters, setFilters] = useState<PartnerListFilters>(defaultPartnerListFilters)
  const [editTarget, setEditTarget] = useState<PartnerEntity | null>(null)
  // Vehicle category and "show deactivated" are filtered server-side (the
  // roster's own vehicles don't carry their Category down to this entity,
  // and the endpoint excludes inactive partners by default) — everything
  // else narrows the already-fetched list client-side.
  const { data: partners, isLoading } = usePartnersControllerList({
    category: filters.category || undefined,
    includeInactive: filters.showInactive || undefined,
  })
  const meta = useMetaControllerGetMeta()
  const setActive = usePartnersControllerSetActive()

  const countryOptions = [{ value: '', label: 'All countries' }, ...useCountryOptions()]
  const areaOptions = useMemo(() => {
    const cities = Array.from(new Set((meta.data?.majorCities ?? []).map((c) => c.name))).sort()
    return [{ value: '', label: 'All areas' }, ...cities.map((name) => ({ value: name, label: name }))]
  }, [meta.data?.majorCities])
  const modelOptions = useMemo(() => {
    const models = Array.from(new Set(Object.values(meta.data?.fleetModelsByMake ?? {}).flat())).sort()
    return [{ value: '', label: 'All models' }, ...models.map((m) => ({ value: m, label: m }))]
  }, [meta.data?.fleetModelsByMake])

  const hasActiveFilters = !!(filters.countryCode || filters.area || filters.model || filters.category || filters.showInactive)
  const set = <K extends keyof PartnerListFilters>(key: K, value: PartnerListFilters[K]) => setFilters((f) => ({ ...f, [key]: value }))
  const resetFilters = () => setFilters(defaultPartnerListFilters())
  const filtered = partners ? applyPartnerFilters(partners, filters) : []

  const toggleActive = async (partner: PartnerEntity) => {
    try {
      await setActive.mutateAsync({ ref: partner.ref, data: { active: !partner.active } })
      toast.success(`Partner ${partner.ref} ${partner.active ? 'deactivated' : 'reactivated'}.`)
      void queryClient.invalidateQueries({ queryKey: getPartnersControllerListQueryKey() })
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error updating partner status.'))
    }
  }

  return (
    <div className="grid gap-3">
      <h2 className="text-lg font-semibold">Partners</h2>

      <FilterCard hasActiveFilters={hasActiveFilters} onReset={resetFilters}>
        <div className="flex flex-wrap items-end gap-3">
          <FilterField label="Country" htmlFor="pt-filter-country" className="w-40">
            <SearchCombobox
              id="pt-filter-country"
              className="w-full"
              value={filters.countryCode}
              onChange={(v) => set('countryCode', v)}
              options={countryOptions}
              placeholder="All countries"
              searchPlaceholder="Search country…"
            />
          </FilterField>
          <FilterField label="Area" htmlFor="pt-filter-area" className="w-40">
            <SearchCombobox
              id="pt-filter-area"
              className="w-full"
              value={filters.area}
              onChange={(v) => set('area', v)}
              options={areaOptions}
              placeholder="All areas"
              searchPlaceholder="Search area…"
            />
          </FilterField>
          <FilterField label="Vehicle model" htmlFor="pt-filter-model" className="w-40">
            <SearchCombobox
              id="pt-filter-model"
              className="w-full"
              value={filters.model}
              onChange={(v) => set('model', v)}
              options={modelOptions}
              placeholder="All models"
              searchPlaceholder="Search model…"
            />
          </FilterField>
          <FilterField label="Vehicle category" htmlFor="pt-filter-category" className="w-40">
            <Select value={filters.category || ALL_CATEGORY} onValueChange={(v) => set('category', v === ALL_CATEGORY ? '' : v)}>
              <SelectTrigger id="pt-filter-category" className="w-full">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CATEGORY}>All categories</SelectItem>
                {(meta.data?.vehicleTypes ?? []).map((v) => (
                  <SelectItem key={v.ref} value={v.name}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <div className="flex h-9 items-center gap-2">
            <Checkbox
              id="pt-show-inactive"
              checked={filters.showInactive}
              onCheckedChange={(checked) => set('showInactive', checked === true)}
            />
            <Label htmlFor="pt-show-inactive" className="text-sm font-normal">
              Show deactivated
            </Label>
          </div>
        </div>
      </FilterCard>

      <TableCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ref</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Area</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="pl-6 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeletonRows columns={COLUMN_COUNT} />
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} className="p-0 whitespace-normal">
                  <EmptyState
                    icon={Building2}
                    title="No partners to display"
                    description='Partners added with "New partner" will appear here.'
                    hasActiveFilters={hasActiveFilters}
                    onResetFilters={resetFilters}
                  />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((partner) => (
                <TableRow key={partner.ref} className={!partner.active ? 'opacity-50' : undefined}>
                  <TableCell className="text-xs font-medium">{partner.ref}</TableCell>
                  <TableCell className="text-xs">
                    <div className="font-medium">{partner.companyName ?? partner.contactName}</div>
                    {!partner.individual && (
                      <div className="text-muted-foreground text-[10px]">Manager: {partner.contactName}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    <Badge variant={partner.individual ? 'secondary' : 'outline'}>
                      {partner.individual ? 'Individual' : 'Partner company'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    <CountryLabel code={partner.countryCode} />
                  </TableCell>
                  <TableCell className="text-xs">{partner.area ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{partner.phone ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{partner.email}</TableCell>
                  <TableCell className="pl-6 whitespace-nowrap">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Edit" onClick={() => setEditTarget(partner)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={partner.active ? 'Deactivate' : 'Reactivate'}
                        onClick={() => void toggleActive(partner)}
                      >
                        {partner.active ? <X className="size-3.5" /> : <RotateCcw className="size-3.5" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableCard>

      <PartnerEditDialog partner={editTarget} onOpenChange={(open) => !open && setEditTarget(null)} />
    </div>
  )
}
