import { useState } from 'react'
import { isLocalTrip, partnerLabel } from '@cockpit/shared'
import { toast } from 'sonner'
import type { TripEntity } from '@cockpit/shared/api'
import {
  getTripsControllerListQueryKey,
  useDriversControllerList,
  useFleetVehiclesControllerList,
  usePartnersControllerList,
  useTripsControllerAssign,
  useTripsControllerUpdate,
  useTripsControllerDispatchDriver,
} from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { useDebouncedSearch } from '@/lib/use-debounced-value'
import { driverOptionLabel } from '@/features/drivers/driver-status'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SearchCombobox } from '@/components/search-combobox'
import { toUpdateTripDto, tripToFormValues } from './trip-form-mapping'
import { SubcontractEmailDialog, type SubcontractEmailTarget } from './subcontract-email-dialog'

const PICKER_LIMIT = 20
const PICKER_DEBOUNCE_MS = 300

/**
 * Quick "assign to" popup of the Bookings board: just the booking number, its
 * Driver and its Vehicle — the two things a dispatcher changes all day — without
 * opening the whole booking form. Clearing a field (the × on the combobox) and
 * saving takes the booking back off that driver/vehicle: the assign route reads
 * an empty string as "unassign".
 */
export function BookingAssignDialog({
  trip,
  onOpenChange,
}: {
  trip: TripEntity | null
  onOpenChange: (open: boolean) => void
}) {
  // The partner email review outlives the popup closing (it opens right after the save).
  const [emailTarget, setEmailTarget] = useState<SubcontractEmailTarget | null>(null)
  // Farm-out (or already sub-contracted) bookings are handed to a partner, not to an own driver.
  const toPartner = !!trip && (!isLocalTrip(trip) || trip.subContractor)
  return (
    <>
      <Dialog open={!!trip} onOpenChange={onOpenChange}>
        <DialogContent>
          {/* keyed by booking so the draft never leaks from one booking to the next */}
          {trip &&
            (toPartner ? (
              <PartnerAssignForm
                key={trip.ref}
                trip={trip}
                onClose={() => onOpenChange(false)}
                onEmail={setEmailTarget}
              />
            ) : (
              <AssignForm key={trip.ref} trip={trip} onClose={() => onOpenChange(false)} />
            ))}
        </DialogContent>
      </Dialog>
      <SubcontractEmailDialog target={emailTarget} onOpenChange={(open) => !open && setEmailTarget(null)} />
    </>
  )
}

type PartnerKind = 'driver' | 'company'

/**
 * Assign popup for a Farm-out booking: the partner (a partner company's driver,
 * or the company alone when it hasn't named anyone yet) and, when that driver
 * has a vehicle linked in the fleet, the vehicle. Saves through the full update
 * (the only route that handles partners), then opens the partner email for review.
 */
function PartnerAssignForm({
  trip,
  onClose,
  onEmail,
}: {
  trip: TripEntity
  onClose: () => void
  onEmail: (target: SubcontractEmailTarget) => void
}) {
  const [kind, setKind] = useState<PartnerKind>(trip.directPartner ? 'company' : 'driver')
  const [partnerRef, setPartnerRef] = useState(trip.partner?.ref ?? '')
  const [directPartnerRef, setDirectPartnerRef] = useState(trip.directPartner?.ref ?? '')
  const [regNbr, setRegNbr] = useState(trip.fleetVehicle?.regNbr ?? '')
  const [partnerSearch, setPartnerSearch] = useState('')
  const { debounced: debouncedPartnerSearch, pending: partnerPending } = useDebouncedSearch(partnerSearch, PICKER_DEBOUNCE_MS)
  const [companySearch, setCompanySearch] = useState('')
  const update = useTripsControllerUpdate()

  const partners = useDriversControllerList({ search: debouncedPartnerSearch || undefined, limit: PICKER_LIMIT })
  const companies = usePartnersControllerList()
  // Vehicles linked to a driver: offered for the chosen partner driver.
  const vehicles = useFleetVehiclesControllerList({ limit: 100 })

  const partnerOptions = (partners.data?.data ?? [])
    .filter((d) => d.active && d.partnerId)
    .map((d) => ({ value: d.ref, label: partnerLabel(d) }))
  const companyLower = companySearch.trim().toLowerCase()
  const companyOptions = (companies.data ?? [])
    .filter((p) => p.active)
    .map((p) => ({ value: p.ref, label: `${p.companyName || p.contactName} (${p.ref})` }))
    .filter((o) => !companyLower || o.label.toLowerCase().includes(companyLower))
  const linkedVehicles = (vehicles.data?.data ?? []).filter((v) => !!partnerRef && v.driver?.ref === partnerRef)
  const regNbrOptions = linkedVehicles.map((v) => ({ value: v.regNbr, label: `${v.regNbr} — ${v.category.name}` }))

  // Picking a partner driver brings along the vehicle linked to them, when there is one.
  const choosePartner = (ref: string) => {
    setPartnerRef(ref)
    const linked = (vehicles.data?.data ?? []).find((v) => !!ref && v.driver?.ref === ref)
    setRegNbr(linked?.regNbr ?? '')
  }

  const chosen = kind === 'driver' ? partnerRef : directPartnerRef
  const initial = trip.directPartner?.ref ?? trip.partner?.ref ?? ''
  const changed = chosen !== initial || (kind === 'driver' && regNbr !== (trip.fleetVehicle?.regNbr ?? ''))

  const submit = async () => {
    const outgoingPartnerRef = trip.partner?.ref
    const outgoingDirectPartnerRef = trip.directPartner?.ref
    const wasFarmedOut = trip.subContractor
    const values = {
      ...tripToFormValues(trip),
      subContractor: true,
      subContractorNoDriver: kind === 'company',
      partnerRef: kind === 'driver' ? partnerRef : '',
      directPartnerRef: kind === 'company' ? directPartnerRef : '',
      fleetRegNbr: kind === 'driver' ? regNbr : '',
    }
    try {
      const response = await update.mutateAsync({
        ref: trip.ref,
        data: toUpdateTripDto(values, { notifyDriver: !!trip.driver }),
      })
      if (response.notifyWarning) toast.warning(response.notifyWarning)
      void queryClient.invalidateQueries({ queryKey: getTripsControllerListQueryKey() })
      toast.success(`Booking ${trip.ref} updated.`)
      onClose()
      const changedPartner =
        kind === 'company' ? directPartnerRef !== outgoingDirectPartnerRef : partnerRef !== outgoingPartnerRef
      if (!wasFarmedOut || changedPartner) onEmail({ ref: trip.ref, kind: 'assigned' })
      else if (response.subcontractUpdateRequired) onEmail({ ref: trip.ref, kind: 'updated' })
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error updating the assignment.'))
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Booking {trip.ref}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4">
        <p className="text-muted-foreground text-sm">Assign to a partner</p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={kind === 'driver' ? 'default' : 'outline'}
            onClick={() => setKind('driver')}
          >
            Partner driver
          </Button>
          <Button
            type="button"
            size="sm"
            variant={kind === 'company' ? 'default' : 'outline'}
            onClick={() => setKind('company')}
          >
            Company only
          </Button>
        </div>
        {kind === 'driver' ? (
          <>
            <div className="grid gap-1.5">
              <Label>Partner driver</Label>
              <SearchCombobox
                value={partnerRef}
                onChange={choosePartner}
                options={partnerOptions}
                placeholder="Partner driver…"
                searchPlaceholder="Search partner…"
                searchValue={partnerSearch}
                onSearchChange={setPartnerSearch}
                loading={partnerPending || partners.isFetching}
                selectedLabel={trip.partner ? partnerLabel(trip.partner) : undefined}
                aria-label="Partner driver"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Vehicle</Label>
              <SearchCombobox
                value={regNbr}
                onChange={setRegNbr}
                options={regNbrOptions}
                placeholder={partnerRef && !regNbrOptions.length ? 'No vehicle linked to this driver' : 'Reg Nbr…'}
                searchPlaceholder="Search reg nbr…"
                searchValue=""
                onSearchChange={() => {}}
                selectedLabel={
                  trip.fleetVehicle ? `${trip.fleetVehicle.regNbr} — ${trip.fleetVehicle.category.name}` : undefined
                }
                aria-label="Vehicle"
              />
            </div>
          </>
        ) : (
          <div className="grid gap-1.5">
            <Label>Partner company</Label>
            <SearchCombobox
              value={directPartnerRef}
              onChange={setDirectPartnerRef}
              options={companyOptions}
              placeholder="Partner company…"
              searchPlaceholder="Search company…"
              searchValue={companySearch}
              onSearchChange={setCompanySearch}
              loading={companies.isFetching}
              selectedLabel={
                trip.directPartner
                  ? `${trip.directPartner.companyName || trip.directPartner.contactName} (${trip.directPartner.ref})`
                  : undefined
              }
              aria-label="Partner company"
            />
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={update.isPending}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!chosen || !changed || update.isPending}>
          {update.isPending && <Spinner />}
          Confirm
        </Button>
      </DialogFooter>
    </>
  )
}

function AssignForm({ trip, onClose }: { trip: TripEntity; onClose: () => void }) {
  const [driverRef, setDriverRef] = useState(trip.driver?.ref ?? '')
  const [regNbr, setRegNbr] = useState(trip.fleetVehicle?.regNbr ?? '')
  const [driverSearch, setDriverSearch] = useState('')
  const [regNbrSearch, setRegNbrSearch] = useState('')
  const { debounced: debouncedDriverSearch, pending: driverPending } = useDebouncedSearch(driverSearch, PICKER_DEBOUNCE_MS)
  const { debounced: debouncedRegNbrSearch, pending: regNbrPending } = useDebouncedSearch(regNbrSearch, PICKER_DEBOUNCE_MS)
  const assign = useTripsControllerAssign()
  const dispatchDriver = useTripsControllerDispatchDriver()

  // Same eligibility the booking form asks the API for (who is free today, which
  // cars fit this category).
  const drivers = useDriversControllerList({
    search: debouncedDriverSearch || undefined,
    limit: PICKER_LIMIT,
    availableOnly: true,
    tripClientRef: trip.client.ref,
    tripArea: trip.area || undefined,
    tripCountryCode: trip.countryCode || undefined,
    tripPickupLocation: trip.pickupLocation || undefined,
    tripDropoffLocation: trip.dropoffLocation || undefined,
  })
  const vehicles = useFleetVehiclesControllerList({
    search: debouncedRegNbrSearch || undefined,
    limit: PICKER_LIMIT,
    availableOnly: true,
    compatibleWith: trip.vehicleType?.name || undefined,
  })

  const driverOptions = (drivers.data?.data ?? []).map((d) => ({ value: d.ref, label: driverOptionLabel(d) }))
  const regNbrOptions = (vehicles.data?.data ?? []).map((v) => ({
    value: v.regNbr,
    label: `${v.regNbr} — ${v.category.name}`,
  }))

  const initialDriver = trip.driver?.ref ?? ''
  const initialRegNbr = trip.fleetVehicle?.regNbr ?? ''
  const changed = driverRef !== initialDriver || regNbr !== initialRegNbr

  // Confirm saves the assignment; Confirm & Send saves it (when something
  // changed) and then sends the job to the driver on WhatsApp.
  const submit = async (send: boolean) => {
    try {
      if (changed) {
        const result = await assign.mutateAsync({
          ref: trip.ref,
          data: {
            ...(driverRef !== initialDriver && { driverRef }),
            ...(regNbr !== initialRegNbr && { fleetRegNbr: regNbr }),
          },
        })
        if (result.notifyWarning) toast.warning(result.notifyWarning)
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error updating the assignment.'))
      return
    }
    void queryClient.invalidateQueries({ queryKey: getTripsControllerListQueryKey() })
    if (!send) {
      toast.success(`Booking ${trip.ref} updated.`)
      onClose()
      return
    }
    try {
      await dispatchDriver.mutateAsync({ ref: trip.ref })
      toast.success(`Booking ${trip.ref} updated and sent to the driver.`)
      void queryClient.invalidateQueries({ queryKey: getTripsControllerListQueryKey() })
      onClose()
    } catch (error) {
      // The assignment itself went through — only the send failed.
      toast.error(getApiErrorMessage(error, 'Assignment saved, but sending to the driver failed.'))
      onClose()
    }
  }
  const pending = assign.isPending || dispatchDriver.isPending

  return (
    <>
      <DialogHeader>
        <DialogTitle>Booking {trip.ref}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4">
        <p className="text-muted-foreground text-sm">Assign to</p>
        <div className="grid gap-1.5">
          <Label>Driver</Label>
          <SearchCombobox
            value={driverRef}
            onChange={setDriverRef}
            options={driverOptions}
            placeholder="Driver…"
            searchPlaceholder="Search driver…"
            searchValue={driverSearch}
            onSearchChange={setDriverSearch}
            loading={driverPending || drivers.isFetching}
            selectedLabel={trip.driver ? driverOptionLabel(trip.driver) : undefined}
            aria-label="Driver"
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Vehicle</Label>
          <SearchCombobox
            value={regNbr}
            onChange={setRegNbr}
            options={regNbrOptions}
            placeholder="Reg Nbr…"
            searchPlaceholder="Search reg nbr…"
            searchValue={regNbrSearch}
            onSearchChange={setRegNbrSearch}
            loading={regNbrPending || vehicles.isFetching}
            selectedLabel={
              trip.fleetVehicle ? `${trip.fleetVehicle.regNbr} — ${trip.fleetVehicle.category.name}` : undefined
            }
            aria-label="Vehicle"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button variant="secondary" onClick={() => submit(false)} disabled={!changed || pending}>
          {pending && <Spinner />}
          Confirm
        </Button>
        <Button
          onClick={() => submit(true)}
          disabled={!driverRef || pending}
          title={driverRef ? undefined : 'Assign a driver first'}
        >
          {pending && <Spinner />}
          Confirm &amp; Send
        </Button>
      </DialogFooter>
    </>
  )
}
