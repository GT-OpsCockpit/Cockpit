import { CalendarClock, CalendarPlus, Car, Lock, Pencil, RotateCcw, X } from 'lucide-react'
import type { DriverEntity } from '@cockpit/shared/api'
import { effectiveActivity, formatPhoneDisplay } from '@cockpit/shared'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/table-card'
import { TableSkeletonRows } from '@/components/table-skeleton-rows'
import { EmptyState } from '@/components/empty-state'
import { InactivityBadge } from '@/components/inactivity-badge'
import { isPartner, unavailabilityLabel } from './driver-status'

interface DriversTableProps {
  drivers: DriverEntity[]
  /** First (uncached) load of the drivers query — shows skeleton rows instead of the empty-state line. */
  loading?: boolean
  onEdit: (driver: DriverEntity) => void
  onUnavailability: (driver: DriverEntity) => void
  onToggleActive: (driver: DriverEntity) => void
  /** Ported from the legacy's padlock (common.js:3538) — only ever set for the Partners table, a local chauffeur never has a reserved External vehicle. */
  onUnlinkVehicle: (driver: DriverEntity) => void
  onNewBooking: (driver: DriverEntity) => void
  /** UX-layer mirror of driver:reactivate (see docs/agents/permissions.md) — deactivating stays ungated. */
  canReactivate: boolean
  hasActiveFilters?: boolean
  onResetFilters?: () => void
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
  const chauffeurs = drivers.filter((d) => !isPartner(d))
  const partners = drivers.filter(isPartner)

  return (
    <div className="grid gap-6">
      <DriverGroup
        title="Chauffeurs"
        drivers={chauffeurs}
        loading={loading}
        onEdit={onEdit}
        onUnavailability={onUnavailability}
        onToggleActive={onToggleActive}
        onUnlinkVehicle={onUnlinkVehicle}
        onNewBooking={onNewBooking}
        canReactivate={canReactivate}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={onResetFilters}
      />
      <DriverGroup
        title="Partenaires"
        drivers={partners}
        loading={loading}
        onEdit={onEdit}
        onUnavailability={onUnavailability}
        onToggleActive={onToggleActive}
        onUnlinkVehicle={onUnlinkVehicle}
        onNewBooking={onNewBooking}
        canReactivate={canReactivate}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={onResetFilters}
      />
    </div>
  )
}

function DriverGroup({
  title,
  drivers,
  loading,
  onEdit,
  onUnavailability,
  onToggleActive,
  onUnlinkVehicle,
  onNewBooking,
  canReactivate,
  hasActiveFilters,
  onResetFilters,
}: DriversTableProps & { title: string }) {
  return (
    <div className="grid gap-2">
      <h2 className="text-sm font-medium">{title}</h2>
      <TableCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ref</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Area</TableHead>
              <TableHead>Unavailability</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeletonRows columns={7} />
            ) : drivers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="p-0 whitespace-normal">
                  <EmptyState
                    icon={Car}
                    title="No records to display"
                    description={`${title} added will appear here.`}
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
                      {driver.name}
                      {driver.company && <span className="text-muted-foreground text-[10px]"> ({driver.company})</span>}
                      <InactivityBadge
                        reason={activity.reason}
                        unavailabilityLabel={unavailabilityLabel(driver.unavailability)}
                      />
                      {driver.fleetReserved && (
                        <div className="text-muted-foreground flex items-center gap-1 text-[10px]">
                          {driver.fleetReserved.regNbr}
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
                    <TableCell className="text-muted-foreground text-xs">{formatPhoneDisplay(driver.phone) || '—'}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{driver.email ?? '—'}</TableCell>
                    <TableCell className="text-xs">{driver.area}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {unavailabilityLabel(driver.unavailability) ?? '—'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" title="New booking" onClick={() => onNewBooking(driver)}>
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
    </div>
  )
}
