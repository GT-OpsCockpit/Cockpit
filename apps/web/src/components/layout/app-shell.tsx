import { NavLink, Outlet, useNavigate } from 'react-router'
import { useAuthControllerLogout, useAuthControllerMe } from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Toaster } from '@/components/ui/sonner'

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

export function AppShell() {
  const navigate = useNavigate()
  // Already warmed by the route loader (requireAuth) — this reads the cache, no extra request.
  const { data: me } = useAuthControllerMe()
  const logout = useAuthControllerLogout()

  const handleLogout = async () => {
    await logout.mutateAsync()
    queryClient.clear()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-border bg-card sticky top-0 z-10 border-b">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <span className="text-primary text-lg font-semibold">Cockpit</span>
          <nav className="flex gap-4 text-sm font-medium">
            {[
              { to: '/bookings', label: 'Bookings' },
              { to: '/clients', label: 'Clients' },
              { to: '/drivers', label: 'Drivers' },
              { to: '/vehicles', label: 'Vehicles' },
              { to: '/planning', label: 'Planning' },
              { to: '/events', label: 'Events' },
              { to: '/invoicing', label: 'Invoicing' },
              { to: '/finance', label: 'Finance' },
              { to: '/settings', label: 'Settings' },
            ].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn('text-muted-foreground hover:text-foreground', isActive && 'text-foreground')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          {me && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <Avatar className="size-7">
                    <AvatarFallback className="text-xs">
                      {initials(me.firstName, me.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline">
                    {me.firstName} {me.lastName}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col">
                    <span className="font-medium">{me.email}</span>
                    <span className="text-muted-foreground text-xs">{me.role}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleLogout}>Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
      <Toaster />
    </div>
  )
}
