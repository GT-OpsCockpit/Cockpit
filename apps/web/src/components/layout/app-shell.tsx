import { Fragment, useEffect, useRef, type KeyboardEvent } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { LogOut } from 'lucide-react'
import cockpitLogo from '@/assets/cockpit-logo.png'
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
import { LiveClock } from './live-clock'
import { NAV_ITEMS } from './nav-items'

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

export function AppShell() {
  const navigate = useNavigate()
  // Already warmed by the route loader (requireAuth) — this reads the cache, no extra request.
  const { data: me } = useAuthControllerMe()
  const logout = useAuthControllerLogout()
  const navRef = useRef<HTMLElement>(null)

  // The nav can overflow its width once every section is added (or on
  // narrower windows). A plain vertical mouse-wheel scroll doesn't move a
  // horizontally-scrolling container by default, so translate it here; a
  // native (non-passive) listener is required to preventDefault the page's
  // own vertical scroll while the pointer is over the nav.
  useEffect(() => {
    const el = navRef.current
    if (!el) return
    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY === 0 || el.scrollWidth <= el.clientWidth) return
      el.scrollLeft += event.deltaY
      event.preventDefault()
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

  const handleNavKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const el = navRef.current
    if (!el) return
    if (event.key === 'ArrowRight') {
      el.scrollBy({ left: 120, behavior: 'smooth' })
      event.preventDefault()
    } else if (event.key === 'ArrowLeft') {
      el.scrollBy({ left: -120, behavior: 'smooth' })
      event.preventDefault()
    } else if (event.key === 'Home') {
      el.scrollTo({ left: 0, behavior: 'smooth' })
      event.preventDefault()
    } else if (event.key === 'End') {
      el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' })
      event.preventDefault()
    }
  }

  const handleLogout = async () => {
    await logout.mutateAsync()
    queryClient.clear()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-border bg-card sticky top-0 z-10 border-b">
        {/* Full-bleed bar; only the clock still lives out in the margin
            (hidden below 2xl, see live-clock.tsx) since it's a nice-to-have,
            not the identity mark — the logo has to actually be visible, so
            it's a normal first item in the centred block below rather than
            something that only appears once there's enough spare margin to
            hold it. */}
        <div className="flex h-20 items-center">
          <div className="mx-auto flex w-full max-w-[1800px] items-center justify-between gap-4 px-4">
            <div className="flex items-center gap-6">
              <span className="flex shrink-0 items-center gap-2">
                <img src={cockpitLogo} alt="" className="h-12 w-12 rounded-md object-cover" />
                <span className="text-base font-semibold whitespace-nowrap">Cockpit x GT-Ops</span>
              </span>

              <nav
                ref={navRef}
                tabIndex={0}
                onKeyDown={handleNavKeyDown}
                className="flex items-center overflow-x-auto text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [scrollbar-width:thin]"
              >
                {NAV_ITEMS.map((item, index) => (
                  <Fragment key={item.to}>
                    {index > 0 && <Separator orientation="vertical" className="mx-2 shrink-0 data-[orientation=vertical]:h-4" />}
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        cn(
                          'text-muted-foreground flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors',
                          'hover:bg-blue-500/10 hover:text-blue-700',
                          isActive && 'nav-link-active',
                        )
                      }
                    >
                      <item.icon className="size-4" />
                      {item.label}
                    </NavLink>
                  </Fragment>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-4">
              <LiveClock />

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
                    <DropdownMenuItem onSelect={handleLogout}>
                      <LogOut />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1800px] px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
