# ADR-0002 — WhatsApp stays behind `WhatsAppProvider`, Twilio is the only implementation

- **Status**: accepted
- **Date**: 2026-08-26
- **Scope**: system-wide (`apps/api` `NotificationsModule`)

## Context

The legacy sent WhatsApp messages straight through the Twilio SDK, inline in the
code that decided *when* to send. Cockpit v2 needed the same capability
(one-way notification today, templated CTA messages planned — see
`docs/WHATSAPP_CTA_PLAN.md`), and the question was whether to keep that
inline shape or introduce a seam.

## Decision

`NotificationsModule` exposes a `WhatsAppProvider` interface
(`send(to, template, vars)`, extended for `sendTemplate` by the CTA plan).
`TwilioWhatsAppProvider` is the only real implementation in v1; a `dev`
provider (console log) is selected automatically when Twilio credentials are
absent, so message-sending code paths are testable without live credentials.

Twilio stays the WhatsApp Business Solution Provider — this ADR does not
revisit that choice. It only says: whatever sends the message, sends it
through this interface, not through the Twilio SDK directly from business
logic.

## Consequences

- Swapping Twilio for a direct Meta Cloud API integration, or a different BSP
  (Dialog360, etc.), is a new class implementing `WhatsAppProvider` — no
  caller changes.
- Anything that needs to send a WhatsApp message calls the interface, never
  `twilio` directly. If a service imports the Twilio SDK outside
  `NotificationsModule`, that's a regression against this decision.
- Do not "simplify" by inlining Twilio calls into `TripsService` or similar
  under the assumption Twilio is permanent — it's a deliberate, revisitable
  choice, not the only option ever considered.
