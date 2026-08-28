import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CompanyTab } from './company-tab'
import { UsersTab } from './users-tab'
import { PageTitle } from '@/components/layout/page-title'

/** Tabs mirror the legacy owner.html's two panels (Company info / Access → Users). */
export function SettingsPage() {
  return (
    <div className="grid gap-6">
      <PageTitle>Settings</PageTitle>

      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>
        <TabsContent value="company">
          <CompanyTab />
        </TabsContent>
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
