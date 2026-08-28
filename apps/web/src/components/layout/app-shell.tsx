import { Fragment } from 'react'
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
import { Separator } from '@/components/ui/separator'
import { Toaster } from '@/components/ui/sonner'
import { NAV_ITEMS } from './nav-items'

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
          <nav className="flex items-center text-sm font-medium">
            {NAV_ITEMS.map((item, index) => (
              <Fragment key={item.to}>
                {index > 0 && <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />}
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'text-muted-foreground flex items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors',
                      'hover:bg-accent hover:text-accent-foreground',
                      isActive && 'bg-accent/60 text-accent-foreground',
                    )
                  }
                >
                  <item.icon className="size-4" />
                  {item.label}
                </NavLink>
              </Fragment>
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
