import { Role } from '../../../generated/prisma/enums';

// Single source of truth for "who can do what" — see docs/agents/permissions.md
// for the full guide (how to add a permission, how to gate a route vs. a
// conditional in-service action, and the legacy-fidelity table this was
// ported from). Every entry here is a plain role list: adding a role, or
// moving a feature between roles, never requires touching the call sites
// below (controllers/services), only this map.
export const PERMISSIONS = {
  'trip:cancel': [Role.ADMIN],
  'trip:edit-past': [Role.ADMIN],
  'trip:edit-price': [Role.ADMIN],
  'client:edit': [Role.ADMIN],
  'company:edit': [Role.ADMIN],
  'user:manage': [Role.ADMIN],
  'driver:reactivate': [Role.ADMIN],
  'vehicle:reactivate': [Role.ADMIN],
  'client:create-past-event': [Role.ADMIN],
} satisfies Record<string, Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export const PERMISSION_NAMES = Object.keys(PERMISSIONS) as Permission[];

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

/** Every permission a given role currently holds — what `GET /auth/me` sends the frontend. */
export function permissionsForRole(role: Role): Permission[] {
  return PERMISSION_NAMES.filter((permission) =>
    roleHasPermission(role, permission),
  );
}

/**
 * The one function to call anywhere an action needs a permission check —
 * whether that's unconditional (via `@RequirePermission()`, which calls this
 * under the hood) or conditional on some business rule the caller computes
 * itself (e.g. "only if this trip's pickup is already in the past").
 */
export function can(user: { role: Role }, permission: Permission): boolean {
  return roleHasPermission(user.role, permission);
}
