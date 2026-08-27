import { useAuthControllerMe, type AuthMeEntityPermissionsItem } from '@cockpit/shared/api'

/**
 * Generic permission check, portable to any feature — see
 * docs/agents/permissions.md. The frontend never re-derives "does this role
 * have this permission" itself: it only ever checks whether a name is in the
 * list the backend already resolved for the current session (`GET
 * /auth/me`'s `permissions` field, warmed by the router's auth loader before
 * any page renders — see components/layout/app-shell.tsx). This is purely a
 * UX layer (hide/disable a control before the user tries and gets a 403);
 * the API enforces the same permissions independently on every request.
 */
export function usePermission(permission: AuthMeEntityPermissionsItem): boolean {
  const { data: me } = useAuthControllerMe()
  return me?.permissions.includes(permission) ?? false
}
