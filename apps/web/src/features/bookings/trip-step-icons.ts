import {
  CheckCheck,
  CircleCheck,
  CircleX,
  Inbox,
  MapPin,
  Navigation,
  Send,
  UserCheck,
  type LucideIcon,
} from 'lucide-react'

/**
 * One lucide icon per trip step, shared by every surface that shows a step —
 * the dispatcher's status badge and both public tracking pages — so the same
 * step never gets two different glyphs. Replaces the emoji the labels used to
 * carry.
 */
export const STEP_ICONS: Record<string, LucideIcon> = {
  TRANSMITTED: Send,
  RECEIVED: Inbox,
  ACCEPTED: CircleCheck,
  ENROUTE: Navigation,
  ARRIVED: MapPin,
  ONBOARD: UserCheck,
  DROPPED: CheckCheck,
  CANCELLED: CircleX,
}
