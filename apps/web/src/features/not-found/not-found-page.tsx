/**
 * What an address nobody typed on purpose lands on.
 *
 * Without a catch-all route React Router falls through to its own development
 * error screen — "Unexpected Application Error! … Hey developer 👋" — which
 * addresses whoever built the app rather than the dispatcher reading it.
 * Rendered inside the AppShell, so the nav is still there and the way back is
 * one click away.
 */
import { Compass } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia } from '@/components/ui/empty'

export function NotFoundPage() {
  return (
    <Empty className="border-none py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Compass />
        </EmptyMedia>
        {/* A real <h1> rather than <EmptyTitle>, which renders a plain div:
            this is a whole page, and every other page here has one. */}
        <h1 className="text-lg font-medium tracking-tight">Page not found</h1>
        <EmptyDescription>This address doesn’t match any page. It may have moved, or the link may be incomplete.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline">
          <Link to="/bookings">Back to Bookings</Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}
