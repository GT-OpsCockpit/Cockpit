import { SetMetadata } from '@nestjs/common';
import type { Permission } from '../permissions/permissions';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Restricts a route to callers holding ALL of the given named permissions
 * (checked by PermissionsGuard, on top of SessionAuthGuard). Use this for a
 * gate that applies unconditionally to a whole route — e.g. every caller of
 * `POST /trips/:ref/cancel-assignment` needs `trip:cancel`, full stop.
 *
 * For a gate that only applies sometimes (depends on the request body or
 * existing DB state — e.g. "only if this trip's pickup is in the past"),
 * don't use this decorator: call `can(user, permission)` directly inside the
 * service method instead. See docs/agents/permissions.md.
 */
export const RequirePermission = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
