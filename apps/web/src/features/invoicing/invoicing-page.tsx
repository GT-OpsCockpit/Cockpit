import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTripEvents } from '../bookings/use-trip-events'
import { CustomerTab } from './customer-tab'
import { DriverLogTab } from './driver-log-tab'
import { HistoryTab } from './history-tab'
import { PartnerLogTab } from './partner-log-tab'

/** Tabs mirror the legacy's #inv-tab (Customer / Driver log / Partner log / History — invoicing.html:38-43). */
export function InvoicingPage() {
  useTripEvents()

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Invoicing</h1>

      <Tabs defaultValue="customer">
        <TabsList>
          <TabsTrigger value="customer">Customer</TabsTrigger>
          <TabsTrigger value="driverlog">Driver log</TabsTrigger>
          <TabsTrigger value="partnerlog">Partner log</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="customer">
          <CustomerTab />
        </TabsContent>
        <TabsContent value="driverlog">
          <DriverLogTab />
        </TabsContent>
        <TabsContent value="partnerlog">
          <PartnerLogTab />
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
