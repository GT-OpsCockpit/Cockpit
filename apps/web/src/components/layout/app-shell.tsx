import { Fragment, useEffect, useRef, type KeyboardEvent } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { LogOut } from 'lucide-react'
import cockpitLogo from '@/assets/cockpit-logo.png'
import cockpitPhoto from '@/assets/cockpit-photo.jpg'
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
        {/* Full-bleed bar whose nav + user block carries the exact `mx-auto max-w-7xl
            px-4` of <main> below, so the nav and the user chip line up with the page
            content at every width. The wordmark and the clock are taken out of the
            flow on purpose: in-flow they push that block off-centre (105px at 1280px),
            which is the one thing this layout must never do. They live in the margins
            the full-bleed bar gains, and each only appears once its margin is wide
            enough to hold it without overlapping the block. */}
        <div className="relative flex h-14 items-center">
          <span className="absolute left-4 hidden items-center gap-2 2xl:flex">
            <img
              src={cockpitPhoto}
              alt=""
              className="h-12 w-[66px] rounded object-cover"
            />
            <img src={cockpitLogo} alt="Cockpit" className="h-[34px] w-auto" />
          </span>

          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4">
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

          <div className="absolute right-4">
            <LiveClock />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
