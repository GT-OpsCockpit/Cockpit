import { createBrowserRouter, Navigate, redirect } from 'react-router'
import { getAuthControllerMeQueryOptions } from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { LoginPage } from '@/features/auth/login-page'
import { AppShell } from '@/components/layout/app-shell'
import { BookingsPage } from '@/features/bookings/bookings-page'

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
  {
    path: '/',
    element: <AppShell />,
    loader: requireAuth,
    children: [
      { index: true, element: <Navigate to="/bookings" replace /> },
      { path: 'bookings', element: <BookingsPage /> },
    ],
  },
])
