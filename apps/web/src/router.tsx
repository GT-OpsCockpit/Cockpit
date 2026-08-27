import { createBrowserRouter, Navigate, redirect } from 'react-router'
import { getAuthControllerMeQueryOptions } from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { LoginPage } from '@/features/auth/login-page'
import { AppShell } from '@/components/layout/app-shell'
import { BookingsPage } from '@/features/bookings/bookings-page'
import { ClientsPage } from '@/features/clients/clients-page'
import { DriversPage } from '@/features/drivers/drivers-page'
import { VehiclesPage } from '@/features/fleet/vehicles-page'
import { PlanningPage } from '@/features/planning/planning-page'
import { EventsPage } from '@/features/events/events-page'
import { InvoicingPage } from '@/features/invoicing/invoicing-page'
import { FinancePage } from '@/features/finance/finance-page'
import { SettingsPage } from '@/features/settings/settings-page'
import { DriverPage } from '@/features/public-tracking/driver-page'
import { TrackPage } from '@/features/public-tracking/track-page'

/** Warms the /auth/me cache before rendering a protected route; a 401 sends the visitor to /login. */
async function requireAuth() {
  try {
    return await queryClient.ensureQueryData(getAuthControllerMeQueryOptions())
  } catch {
    throw redirect('/login')
  }
}

/** A visitor who is already logged in shouldn't see the login form again. */
async function redirectIfAuthenticated() {
  try {
    await queryClient.ensureQueryData(getAuthControllerMeQueryOptions())
    throw redirect('/bookings')
  } catch (error) {
    if (error instanceof Response) throw error
    return null
  }
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
    loader: redirectIfAuthenticated,
  },
  // Public, no session required — same as the legacy's chauffeur.html/dashboard.html.
  { path: '/driver/:ref', element: <DriverPage /> },
  { path: '/track/:ref', element: <TrackPage /> },
  {
    path: '/',
    element: <AppShell />,
    loader: requireAuth,
    children: [
      { index: true, element: <Navigate to="/bookings" replace /> },
      { path: 'bookings', element: <BookingsPage /> },
      { path: 'clients', element: <ClientsPage /> },
      { path: 'drivers', element: <DriversPage /> },
      { path: 'vehicles', element: <VehiclesPage /> },
      { path: 'planning', element: <PlanningPage /> },
      { path: 'events', element: <EventsPage /> },
      { path: 'invoicing', element: <InvoicingPage /> },
      { path: 'finance', element: <FinancePage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])
