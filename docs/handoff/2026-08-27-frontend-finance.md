# Handoff — Cockpit v2, `/finance` (dernier élément de `docs/FRONTEND_PLAN.md`)

> Suite de `2026-08-27-frontend-public-tracking.md`, qui laissait `/finance` comme seul élément restant du plan.

**Session du** : 2026-08-27

## Contexte

`docs/LEGACY_FEATURES.md` §"finance.html" : « Stub vide ("Coming soon"), aucune logique. » — contrairement à `finance.html` d'Invoicing (Driver log/History), il n'y a ici aucune spec legacy à porter, aucun endpoint back existant ou attendu (`grep -rn -i finance apps/api/src` : rien), et aucun scope documenté ailleurs vers lequel grandir. Fermer cet élément consiste donc uniquement à faire exister la page dans v2, au même niveau (zéro) que dans le legacy — pas une session d'implémentation.

## Ce qui a changé

- `apps/web/src/features/finance/finance-page.tsx` (nouveau) — même gabarit que `HistoryTab`/`DriverLogTab` d'Invoicing (titre + `<p>Coming soon.</p>`), avec un commentaire renvoyant vers `LEGACY_FEATURES.md` plutôt qu'un doc de scope futur puisqu'il n'y en a pas.
- `apps/web/src/router.tsx` — route authentifiée `finance` ajoutée, entre `invoicing` et `settings` (même ordre que le nav et que le plan).
- `apps/web/src/components/layout/app-shell.tsx` — lien "Finance" ajouté au nav, même position.

Aucun changement back (rien à exposer), aucune nouvelle dépendance, aucune migration.

## Tests

Aucun test dédié ajouté — même choix que pour `HistoryTab`/`DriverLogTab` (composant statique sans logique, rien à couvrir). Suite existante inchangée, relancée pour non-régression.

## Résultats finaux

- `pnpm --filter @cockpit/web exec tsc --noEmit -p tsconfig.app.json` → propre
- `pnpm --filter @cockpit/web lint` → 8 warnings, tous préexistants (même baseline que la session précédente)
- `pnpm --filter @cockpit/web test` → **267/267** (inchangé)
- Vérification manuelle au navigateur (chrome-devtools MCP) : nav affiche "Finance" entre Invoicing et Settings, `/finance` rend "Finance / Coming soon.", aucune erreur console nouvelle (le seul warning présent — `No HydrateFallback element` — est préexistant et présent aussi sur `/bookings`, vérifié en comparaison).

## Environnement pour reprendre

`docker compose` (dev, 5173/3000) déjà up, hot-reload actif — aucun rebuild nécessaire (aucune nouvelle dépendance).

**Prochaine étape** : `docs/FRONTEND_PLAN.md` n'a plus d'élément restant dans sa liste de pages — toutes les pages authentifiées et les deux pages publiques sont construites. Dette connue non bloquante : `Driver log`/`History` d'Invoicing restent des placeholders documentés (`docs/agents/event-log-design.md`), et le padlock legacy de déliaison véhicule↔chauffeur a été fermé (`2026-08-27-frontend-drivers-vehicles-unlink.md`). Toute suite (durcissement, tests e2e cross-verticale, vraie page Finance si le besoin apparaît) serait un nouveau scope, pas une continuation directe du plan actuel.
