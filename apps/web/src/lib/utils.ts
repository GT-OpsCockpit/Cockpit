import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Every filter-bar "Reset filters" button and every list's filtered-to-zero
 * empty state need to know whether the current filters differ from their
 * defaults. Filter objects across the app are flat (strings/booleans/numbers
 * only), so a JSON comparison is enough — no need for a deep-equal dependency.
 */
export function filtersChanged<T>(current: T, defaults: T): boolean {
  return JSON.stringify(current) !== JSON.stringify(defaults)
}

/**
 * A stored ISO date as the roster lists show it: DD/MM/YYYY, the format the
 * legacy's ymdToDmy produced (common.js). Shared by the Drivers and Vehicles
 * unavailability labels, which had a copy each.
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB')
}
