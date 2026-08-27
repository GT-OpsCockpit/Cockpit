# Handoff — Frontend Cockpit v2, verticale Login + Bookings (suite 12)

> Continue `2026-08-27-frontend-bookings-11.md` (même journée, reprise directe). Voir aussi `docs/FRONTEND_PLAN.md` (Journal).

**Session du** : 2026-08-27
**Portée** : Dernier scénario e2e explicitement listé dans le plan initial et jamais fait — "farm-out avec sub-contractor". Avec ce fichier, tous les items de test nommément identifiés dans `docs/FRONTEND_PLAN.md` § Journal ("Playwright e2e sur le parcours création→dispatch→statuts" + RBAC + farm-out) et dans la traîne des handoffs (sessions 7 à 11) sont couverts.

---

## Où on en est en une phrase

6 tests Playwright (4 fichiers) + 50 tests Vitest (2 fichiers), tous verts — la suite e2e couvre maintenant aussi le chemin farm-out/sous-traitance, jamais exercé avant (le seul scénario e2e du plan initial qui restait à zéro).

## Fait et vérifié

### `e2e/farm-out-subcontractor.spec.ts` (nouveau)

Le comportement `isStatusLocked`/`isStatusAdvanceable` (unitaire depuis la session 9) et sa contrepartie serveur (`TripsService.create`/`advanceStep`, jamais lus en détail avant cette session) prouvés en conditions réelles :

- **Sous-traité sans partenaire sur le dossier** : `TripsService.create` verrouille et **auto-tamponne un step `TRANSMITTED`** dès la création (`locked = subContractor && !partner`) — le badge affiche donc directement "📤 Sent ✅", mais **pas cliquable** (`isStatusAdvanceable` faux → pas de `title="Click to validate the next step"` dans la ligne). Un appel direct `POST /:ref/advance-step` confirme le 400 serveur ("This job is sub-contracted to a company with no driver on file — status stays at Sent.").
- **Sous-traité avec un partenaire assigné** (driver fixture "James Whitfield / Uber Elite London", `subContractor.ts` seedFixtures) : pas de step auto à la création (badge "📤 Send ?"), le bouton Dispatch n'est **jamais grisé** pour un job sous-traité (`dispatchButtonState` — vérifié en unitaire session 9, ici en e2e) — cliqué, confirmé, `dispatchDriver()` envoie au `partner.phone` (pas `driver.phone`) et tamponne `TRANSMITTED`. Le badge devient alors cliquable, une validation d'étape l'avance à "📥 Received" — même mécanique que le parcours Local de `booking-lifecycle.spec.ts`, jamais vérifiée côté Farm-out/sous-traitance avant.

Setup via l'API (client "Marc Dubois", driver "James Whitfield" — mêmes fixtures stables par email que les specs RBAC des sessions 11), UI exercée uniquement sur ce qui est sous test (badge, Dispatch, Advance) — même style que `trip-cancel-rbac.spec.ts`/`trip-edit-rbac.spec.ts`.

**Vérifié** : suite complète (`pnpm --filter @cockpit/web test:e2e`) — **4 fichiers, 6 tests**, tous verts, deux exécutions consécutives sans reset de la base. `tsc --noEmit`/`oxlint` propres. Suite Vitest (50 tests) inchangée, toujours verte.

## Bilan de la traîne de sessions 7 à 12 (test coverage Bookings)

Tout ce qui était listé comme "pas commencé"/"non prioritaire" dans les handoffs successifs sur le sujet tests est maintenant fait :

| Item | Origine | Statut |
|---|---|---|
| Item #7 dispatch "driver/véhicule manquant" | sessions 2→7 | ✅ session 8 |
| Suite Vitest (validation conditionnelle + machine à états) | plan initial | ✅ session 9 |
| Suite Vitest (filtres/géo/temps) | session 9 | ✅ session 10 |
| Gap accessibilité `search-combobox.tsx` | session 6→7 | ✅ session 10 |
| RBAC e2e (`trip:cancel`) | session 7→8 (plan) | ✅ session 11 |
| Édition verrouillée e2e (`trip:edit-past`/`trip:edit-price`) | session 7→8 (plan) | ✅ session 11 |
| Farm-out avec sub-contractor e2e | plan initial | ✅ session 12 (ce fichier) |

## Pas commencé

- **Tests de composant (Testing Library)** — toujours zéro, mentionné nommément par le plan ("Vitest + Testing Library"). Seule la logique pure est testée pour l'instant (form-schema/trip-status). Premier candidat naturel : `DispatchButton`/`StatusBadge` (comportement de clic conditionnel, déjà couvert indirectement par Playwright mais jamais isolément).
- Gap d'accessibilité mineur sur le `<Select>` de période de la barre de filtres (pas de `FormLabel`, découvert session 11) — noté, pas corrigé.
- Rien d'autre n'est identifié comme ouvert sur la verticale Bookings à ce stade — le reste du travail restant concerne les autres pages du plan (`/clients`, `/drivers`, `/vehicles`, `/planning`, `/events`, `/invoicing`, `/finance`, `/settings`, pages publiques `/driver/:ref` et `/track/:ref`), qui n'ont pas encore de frontend v2 du tout (`docs/FRONTEND_PLAN.md` : "verticale complète d'abord... Les autres pages... suivront en itérations séparées").

## Environnement pour reprendre

Inchangé, rien de nouveau à installer/configurer.

**Prochaine étape concrète recommandée** : la verticale Bookings est maintenant fonctionnellement et techniquement complète au sens du plan initial (fonctionnalité + tests). Le choix naturel suivant est soit un premier test de composant Testing Library pour clore complètement l'item "Vitest + Testing Library" du plan, soit — plus structurant — démarrer la prochaine verticale (`/clients`, `/drivers` ou `/vehicles`, les plus proches de Bookings par les entités déjà modélisées côté API).
