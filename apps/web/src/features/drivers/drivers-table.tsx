import { CalendarClock, CalendarPlus, Car, Lock, Pencil, RotateCcw, X } from 'lucide-react'
import type { DriverEntity } from '@cockpit/shared/api'
import { effectiveActivity, formatPhoneDisplay } from '@cockpit/shared'
import { cn } from '@/lib/utils'
import { CountryLabel } from '@/components/country-label'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/table-card'
import { TableSkeletonRows } from '@/components/table-skeleton-rows'
import { EmptyState } from '@/components/empty-state'
import { InactivityBadge } from '@/components/inactivity-badge'
import { unavailabilityLabel } from './driver-status'

const COLUMN_COUNT = 9

interface DriversTableProps {
  drivers: DriverEntity[]
  /** First (uncached) load of the drivers query — shows skeleton rows instead of the empty-state line. */
  loading?: boolean
  onEdit: (driver: DriverEntity) => void
  onUnavailability: (driver: DriverEntity) => void
  onToggleActive: (driver: DriverEntity) => void
  /** Ported from the legacy's padlock (common.js:3538) — only ever set for a partner's own chauffeur, an in-house one never has a reserved External vehicle. */
  onUnlinkVehicle: (driver: DriverEntity) => void
  onNewBooking: (driver: DriverEntity) => void
  /** UX-layer mirror of driver:reactivate (see docs/agents/permissions.md) — deactivating stays ungated. */
  canReactivate: boolean
  hasActiveFilters?: boolean
  onResetFilters?: () => void
}

/**
 * The Company a driver is shown against — the real Partner's own name once
 * they're actually linked (`partnerId`), falling back to the legacy free-text
 * `company` field for one that isn't, and "In-house" for neither. One column,
 * one list: an earlier version of this table split in-house vs. partner
 * drivers into two separate tables, which just made "is this driver in-house
 * or whose?" a matter of which table you were looking at instead of which
 * cell — this column answers it directly, per row.
 */
function companyLabel(driver: DriverEntity): string {
  // An individual partner has no companyName (see Partner.companyName's
  // comment) — shown as "Individual" rather than falling back to their own
  // contactName, which the Name column already carries. A company partner's
  // driver shows the real companyName once linked (partnerId); a driver
  // never linked to any real Partner falls back to the legacy free-text
  // `company` field, then "In-house".
  if (driver.partner?.individual) return 'Individual'
  return driver.partner?.companyName || driver.company || 'In-house'
}

export function DriversTable({
  drivers,
  loading = false,
  onEdit,
  onUnavailability,
  onToggleActive,
  onUnlinkVehicle,
  onNewBooking,
  canReactivate,
  hasActiveFilters,
  onResetFilters,
}: DriversTableProps) {
  return (
    <TableCard>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ref</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Country</TableHead>
            <TableHead>Area</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Unavailability</TableHead>
            <TableHead className="pl-6 text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableSkeletonRows columns={COLUMN_COUNT} />
          ) : drivers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT} className="p-0 whitespace-normal">
                <EmptyState
                  icon={Car}
                  title="No records to display"
                  description="Drivers added will appear here."
                  hasActiveFilters={hasActiveFilters}
                  onResetFilters={onResetFilters}
                />
              </TableCell>
            </TableRow>
          ) : (
            drivers.map((driver) => {
              const canReactivateThis = driver.active || canReactivate
              // Beyond the manual flag, a driver is also unavailable while a
              // day off/holiday/sick marker covers today, and an
              // Events-scoped one outside its event's dates — the legacy
              // greyed the row for all three (isEffectivelyActive,
              // common.js:3010) and named which.
              const activity = effectiveActivity(driver, driver.eventClient)
              return (
                <TableRow key={driver.ref} className={cn(!activity.active && 'opacity-50')}>
                  <TableCell className="text-xs font-medium">{driver.ref}</TableCell>
                  <TableCell className="text-xs">
                    <div className="font-medium">{driver.name}</div>
                    <div className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px]">
                      <InactivityBadge
                        reason={activity.reason}
                        unavailabilityLabel={unavailabilityLabel(driver.unavailability)}
                      />
                    </div>
                    {driver.fleetReserved && (
                      <div className="text-muted-foreground mt-0.5 flex items-center gap-1 text-[10px]">
                        <span>{driver.fleetReserved.regNbr}</span>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          title="Unlink this vehicle from the chauffeur"
                          onClick={() => onUnlinkVehicle(driver)}
                        >
                          <Lock className="size-3" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    <CountryLabel code={driver.countryCode} />
                  </TableCell>
                  <TableCell className="text-xs">{driver.area}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{companyLabel(driver)}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{formatPhoneDisplay(driver.phone) || '—'}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{driver.email ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {unavailabilityLabel(driver.unavailability) ?? '—'}
                  </TableCell>
                  <TableCell className="pl-6 whitespace-nowrap">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="New booking"
                        onClick={() => onNewBooking(driver)}
                        className="btn-validate-green"
                      >
                        <CalendarPlus className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Edit" onClick={() => onEdit(driver)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Unavailability" onClick={() => onUnavailability(driver)}>
                        <CalendarClock className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={
                          driver.active
                            ? 'Deactivate'
                            : canReactivate
                              ? 'Reactivate'
                              : 'Reactivating requires the Admin role'
                        }
                        disabled={!canReactivateThis}
                        onClick={() => onToggleActive(driver)}
                      >
                        {driver.active ? <X className="size-3.5" /> : <RotateCcw className="size-3.5" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </TableCard>
  )
}
