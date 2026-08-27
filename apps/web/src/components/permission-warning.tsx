/**
 * The banner shown when `usePermission()` says the current user can't perform the
 * action a dialog is offering. Only the markup is shared — which controls each
 * call site disables is genuinely its own decision, and stays there (see
 * docs/agents/permissions.md). This is UX only; the API enforces independently.
 */
export function PermissionWarning({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-destructive/50 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
      {children}
    </p>
  )
}
