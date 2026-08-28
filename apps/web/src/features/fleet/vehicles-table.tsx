import { CalendarPlus, Pencil, RotateCcw, Wrench, X } from 'lucide-react'
import type { FleetColorEntity, FleetVehicleEntity } from '@cockpit/shared/api'
import { cn } from '@/lib/utils'
import { driverDisplayName } from '@/features/bookings/trip-status'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CountryLabel } from '@/components/country-label'
import { TableCard } from '@/components/table-card'
import { TableSkeletonRows } from '@/components/table-skeleton-rows'
import { unavailabilityLabel } from './vehicle-status'

interface VehiclesTableProps {
  vehicles: FleetVehicleEntity[]
  /** First (uncached) load of the vehicles query — shows skeleton rows instead of the empty-state line. */
  loading?: boolean
  onEdit: (vehicle: FleetVehicleEntity) => void
  onUnavailability: (vehicle: FleetVehicleEntity) => void
  onToggleActive: (vehicle: FleetVehicleEntity) => void
  onNewBooking: (vehicle: FleetVehicleEntity) => void
  /** UX-layer mirror of vehicle:reactivate (see docs/agents/permissions.md) — deactivating stays ungated. */
  canReactivate: boolean
  /** For the Color swatch's dot — kept as a prop (fetched by the page) rather than an internal useMetaControllerGetMeta() call, so this stays a plain presentational component like DriversTable. */
  fleetColors?: FleetColorEntity[]
}

function ColorSwatch({ color, hex }: { color: string; hex?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-3 rounded-full border" style={{ backgroundColor: hex ?? '#1a1a1a' }} />
      {color}
    </span>
  )
}

function CategoryCell({ vehicle }: { vehicle: FleetVehicleEntity }) {
  return (
    <>
      {vehicle.category.name}
      {vehicle.eventsOnly && (
        <span className="bg-accent ml-1 rounded px-1 py-0.5 text-[10px]">Events</span>
      )}
    </>
  )
}

function ActionCell({
  vehicle,
  onEdit,
  onUnavailability,
  onToggleActive,
  onNewBooking,
  canReactivate,
  showUnavailability,
}: VehiclesTableProps & { vehicle: FleetVehicleEntity; showUnavailability: boolean }) {
  const canReactivateThis = vehicle.active || canReactivate
  return (
    <TableCell className="whitespace-nowrap">
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" title="New booking" onClick={() => onNewBooking(vehicle)}>
          <CalendarPlus className="size-3.5" />
        </Button>
        {showUnavailability && (
          <Button variant="ghost" size="icon" title="Repair shop / Manufacturer service / Bodywork" onClick={() => onUnavailability(vehicle)}>
            <Wrench className="size-3.5" />
          </Button>
        )}
        <Button variant="ghost" size="icon" title="Edit" onClick={() => onEdit(vehicle)}>
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title={
            vehicle.active
              ? 'Deactivate'
              : canReactivate
                ? 'Reactivate'
                : 'Reactivating requires the Admin role'
          }
          disabled={!canReactivateThis}
          onClick={() => onToggleActive(vehicle)}
        >
          {vehicle.active ? <X className="size-3.5" /> : <RotateCcw className="size-3.5" />}
        </Button>
      </div>
    </TableCell>
  )
}

export function VehiclesTable(props: VehiclesTableProps) {
  const colorHex = (color: string) => props.fleetColors?.find((c) => c.value === color)?.hex

  const internal = props.vehicles.filter((v) => v.isLocal)
  const external = props.vehicles.filter((v) => !v.isLocal)

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h2 className="text-sm font-medium">Fleet - Internal</h2>
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Reg Nbr</TableHead>
                <TableHead>Acr.</TableHead>
                <TableHead>Make</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>4WD</TableHead>
                <TableHead>Nb Pax</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.loading ? (
                <TableSkeletonRows columns={11} />
              ) : internal.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-muted-foreground text-center">
                    No internal vehicles yet.
                  </TableCell>
                </TableRow>
              ) : (
                internal.map((vehicle) => (
                  <TableRow key={vehicle.ref} className={cn(!vehicle.active && 'opacity-50')}>
                    <TableCell className="text-xs font-medium">{vehicle.ref}</TableCell>
                    <TableCell className="text-xs">
                      <CategoryCell vehicle={vehicle} />
                    </TableCell>
                    <TableCell className="text-xs">
                      {vehicle.regNbr}
                      {vehicle.unavailability && (
                        <div className="text-muted-foreground text-[10px]">{unavailabilityLabel(vehicle.unavailability)}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{vehicle.acronym ?? '—'}</TableCell>
                    <TableCell className="text-xs">{vehicle.make}</TableCell>
                    <TableCell className="text-xs">{vehicle.model}</TableCell>
                    <TableCell className="text-xs">{vehicle.yearOfBuild}</TableCell>
                    <TableCell className="text-xs">{vehicle.fourWD ? 'Yes' : 'No'}</TableCell>
                    <TableCell className="text-xs">{vehicle.nbPax}</TableCell>
                    <TableCell className="text-xs">
                      <ColorSwatch color={vehicle.color} hex={colorHex(vehicle.color)} />
                    </TableCell>
                    <ActionCell {...props} vehicle={vehicle} showUnavailability />
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableCard>
      </div>

      <div className="grid gap-2">
        <h2 className="text-sm font-medium">Fleet - External</h2>
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Reg Nbr</TableHead>
                <TableHead>Acr.</TableHead>
                <TableHead>Make</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>4WD</TableHead>
                <TableHead>Nb Pax</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.loading ? (
                <TableSkeletonRows columns={14} />
              ) : external.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={14} className="text-muted-foreground text-center">
                    No external vehicles yet.
                  </TableCell>
                </TableRow>
              ) : (
                external.map((vehicle) => (
                  <TableRow key={vehicle.ref} className={cn(!vehicle.active && 'opacity-50')}>
                    <TableCell className="text-xs font-medium">{vehicle.ref}</TableCell>
                    <TableCell className="text-xs">
                      <CountryLabel code={vehicle.countryCode} />
                    </TableCell>
                    <TableCell className="text-xs">{vehicle.area ?? '—'}</TableCell>
                    <TableCell className="text-xs">{vehicle.partnerCompany ?? '—'}</TableCell>
                    <TableCell className="text-xs">
                      <CategoryCell vehicle={vehicle} />
                    </TableCell>
                    <TableCell className="text-xs">
                      {vehicle.regNbr}
                      {vehicle.driver && (
                        <div className="text-muted-foreground text-[10px]">{driverDisplayName(vehicle.driver)}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{vehicle.acronym ?? '—'}</TableCell>
                    <TableCell className="text-xs">{vehicle.make}</TableCell>
                    <TableCell className="text-xs">{vehicle.model}</TableCell>
                    <TableCell className="text-xs">{vehicle.yearOfBuild}</TableCell>
                    <TableCell className="text-xs">{vehicle.fourWD ? 'Yes' : 'No'}</TableCell>
                    <TableCell className="text-xs">{vehicle.nbPax}</TableCell>
                    <TableCell className="text-xs">
                      <ColorSwatch color={vehicle.color} hex={colorHex(vehicle.color)} />
                    </TableCell>
                    <ActionCell {...props} vehicle={vehicle} showUnavailability={false} />
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableCard>
      </div>
    </div>
  )
}
