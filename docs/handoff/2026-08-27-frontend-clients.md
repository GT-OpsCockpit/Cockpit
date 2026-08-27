# Handoff — Frontend Cockpit v2, verticale Clients (démarrage)

> Nouvelle verticale (pas une suite de `2026-08-27-frontend-bookings-*.md`). Voir `docs/FRONTEND_PLAN.md` (page `/clients`) et `docs/LEGACY_FEATURES.md` §10 (`clients.html`).

**Session du** : 2026-08-27
**Portée** : Choix de la prochaine page à construire après la clôture complète de la verticale Bookings (voir `2026-08-27-frontend-bookings-13.md`). Clients a été choisi comme le plus logique — modèle de données le plus simple des trois pages restantes proches (`/clients`, `/drivers`, `/vehicles`), API déjà 100% prête côté back, et c'est l'entité dont dépend chaque course créée dans Bookings.

**Important — écart avec la consigne initiale** : l'utilisateur avait demandé de choisir la page et de **décrire quoi faire dans ce handoff**, pas de l'implémenter — un autre agent devait s'en charger. Une bonne partie a été construite et vérifiée avant que ce soit clarifié en cours de session. Décision de l'utilisateur une fois le malentendu signalé : **garder le travail déjà fait** (il est réel, vérifié, propre) plutôt que de l'annuler. Ce fichier documente donc à la fois ce qui est fait *et* ce qui reste — l'agent qui reprend doit lire "Pas fait / pas vérifié" avec la même attention que "Fait et vérifié", pas juste continuer comme si tout restait à construire.

---

## Où on en est en une phrase

La page `/clients` existe, compile, est lintée proprement, et le chemin de création "Individual" a été vérifié de bout en bout au navigateur (y compris les erreurs de validation) — mais Company/Events (créées seulement visuellement, jamais soumises), l'édition, l'activation/désactivation, les filtres, et **toute couverture de test automatisée** restent à vérifier ou à écrire.

## Fait et vérifié

### Backend — permission `client:edit` (nouvelle, suit le pattern déjà établi pour Bookings)

`docs/agents/permissions.md` documentait déjà ce gap précisément : "`common.js:3423` — edit a customer account — always — *(none yet)* — not built... Suggested name: `client:edit`". Traité maintenant, à l'identique du pattern `trip:cancel`/`trip:edit-past` :
- `apps/api/src/common/permissions/permissions.ts` : `'client:edit': [Role.ADMIN]` ajouté à `PERMISSIONS`.
- `apps/api/src/clients/clients.controller.ts` : `@RequirePermission('client:edit')` sur `update()` uniquement (pas `create`/`delete`/`setActive` — mirrors le legacy où seule la sauvegarde d'une édition demandait le mot de passe manager, cf. `LEGACY_FEATURES.md` §10 : "tableau avec édition (mot de passe manager requis pour sauvegarder), désactivation réversible" — la désactivation n'est pas décrite comme protégée, contrairement à l'édition).
- `docs/agents/permissions.md` : ligne du tableau mise à jour (❌→✅).
- `apps/api/test/permissions.e2e-spec.ts` : nouveau cas "client:edit is unconditional — a DISPATCHER is blocked, an ADMIN is allowed" + `client:edit` ajouté à la liste attendue dans le test `GET /auth/me`.
- Client typé frontend régénéré (`pnpm --filter @cockpit/web api:generate`, API dev up sur :3000) — `AuthMeEntityPermissionsItem` inclut maintenant `'client:edit'`.

**Vérifié** : `pnpm --filter @cockpit/api test:e2e` (suite Jest complète) → **89/89 verts** (88 + le nouveau cas). `tsc --noEmit` côté web propre après régénération du client.

### Frontend — page `/clients`

Nouveaux fichiers, tous dans `apps/web/src/features/clients/` :
- `client-form-schema.ts` — schéma zod avec `superRefine` reproduisant **exactement** les règles conditionnelles de `ClientsService.create()`/`update()` (côté back, lu en détail avant d'écrire ceci) : `company` requis si type Company ou Event (libellé "Event name" affiché mais même champ `company` sous le capot — le back utilise la même colonne pour les deux, confirmé en lisant `clients.service.ts`) ; `eventCountry`/`eventArea`/`eventStartDate`/`eventEndDate` tous requis si Event ; `contactFirstName`+`contactLastName` requis si Individual.
- `client-form-mapping.ts` — `clientToFormValues` (préremplissage édition) + `toCreateClientDto`/`toUpdateClientDto` (les deux DTOs acceptent exactement le même jeu de champs, donc une seule fonction interne `toClientDto` partagée).
- `client-form-fields.tsx` — champs partagés création/édition, layout conditionnel sur `clientType` (watch RHF), `SearchCombobox` réutilisé tel quel pour `countryCode`/`eventCountry` (bénéficie du fix d'accessibilité de la session 10 — vérifié, `combobox "Country"` a bien un nom accessible dans l'arbre a11y, cf. capture ci-dessous).
- `client-create-dialog.tsx` — bouton "New account" + Dialog auto-contenu (pas de bouton persistant type "barre de création" comme Bookings — décision de simplicité, le legacy ne semble pas dupliquer clients.html avec une barre partagée comme dispatcher.html/clients.html/drivers.html/events.html le font pour les *courses*).
- `client-edit-dialog.tsx` — même pattern que `booking-edit-dialog.tsx` : `usePermission('client:edit')`, formulaire désactivé + bandeau d'avertissement si pas Admin. **Jamais ouvert au navigateur — voir "Pas fait" ci-dessous.**
- `clients-table.tsx` — une seule table (pas de split Local/Farm-out comme Bookings — le legacy décrit "un tableau", singulier), colonnes Ref/Name/Type/Email/POC phone/Billing/Action, lignes désactivées en `opacity-50`. Actions : Edit (pencil), Deactivate/Reactivate (X / RotateCcw selon `client.active`). **Pas de bouton de suppression définitive** — décision délibérée, cohérente avec `docs/agents/permissions.md` : "`common.js:388` — permanent hard-delete — not built — no v2 UI exposes a hard-delete yet" pour toutes les entités déjà portées ; l'API `DELETE /api/clients/:ref` existe toujours côté back (protégée par un check trips/invoices) mais n'est intentionnellement pas exposée dans l'UI, exactement comme Bookings ne l'expose pas pour les autres entités.
- `client-filters-bar.tsx` — recherche (ref/nom/email/acronyme) + filtre type + case "Show deactivated". **Jamais exercé au navigateur.**
- `client-status.ts` — `clientTypeLabel`, `defaultClientFilters`, `applyClientFilters`.
- `router.tsx` : route `/clients` ajoutée. `app-shell.tsx` : nav statique ("Bookings" en texte brut) remplacée par de vrais `NavLink` Bookings/Clients avec état actif.

**Vérifié au navigateur** (chrome-devtools MCP, admin) :
- Page `/clients` charge, liste les 2 clients seedés (`CC1` Atlas Capital, `CI1` Marc Dubois) avec les bonnes colonnes.
- Dialog "New account" s'ouvre, tous les champs ont un nom accessible correct (`combobox "Country"` etc. — pas de régression sur le fix a11y de session 10).
- Soumission à vide en type Individual → erreurs affichées correctement ("First and last name are required for an Individual-type account.") sur les deux champs, `aria-invalid` posé.
- Création Individual complète (Sophie Martin, sophie.martin@example.com) → toast "Account CI2 created.", ligne ajoutée à la table.
- Bascule Individual→Company→Events dans le Select : les champs conditionnels changent bien (Company : "Company name" ; Events : "Event name" + Event country/area + Start/End date apparaissent, First/Last name disparaissent).

`pnpm --filter @cockpit/web exec tsc --noEmit` : propre. `pnpm --filter @cockpit/web lint` : aucun warning nouveau (mêmes 5 warnings pré-existants qu'avant cette session).

## Pas fait / pas vérifié — à traiter avant de considérer cette page terminée

**Chemins fonctionnels jamais exercés** (dialogs ouverts visuellement mais formulaire jamais soumis, ou jamais ouverts du tout) :
- Création Company de bout en bout (jamais soumise).
- Création Events de bout en bout (jamais soumise — dialog fermé via Échap sans sauvegarder quand la session a été interrompue).
- **Édition d'un client existant — jamais ouverte au navigateur.** À vérifier en priorité : le préremplissage (`clientToFormValues`), le bandeau/désactivation si non-Admin (il n'existe actuellement aucun moyen de tester ça en Dispatcher au navigateur — pas de compte dispatcher dans le seed de dev, contrairement au seed e2e qui en crée un via `auth.setup.ts`), et que la sauvegarde fonctionne.
- Désactivation/réactivation (`setActive`) — bouton jamais cliqué.
- Barre de filtres — recherche, filtre type, case "Show deactivated" — jamais exercés.
- Champ `countryCode` général (adresse) — jamais rempli/sauvegardé.

**Aucun test automatisé écrit** — écart net avec la rigueur appliquée à Bookings (sessions 9/10/13) :
- Pas de test Vitest sur `client-form-schema.ts` (les règles conditionnelles mériteraient le même traitement que `trip-form-schema.test.ts` — cas Individual/Company/Events, chaque combinaison de champs manquants).
- Pas de test Vitest sur `client-status.ts` (`applyClientFilters` notamment).
- Pas de test de composant Testing Library.
- Pas de spec Playwright — ni parcours nominal (créer/éditer/désactiver un client), ni RBAC (`client:edit` bloqué en DISPATCHER — le pattern existe déjà tel quel dans `trip-edit-rbac.spec.ts`, à dupliquer/adapter).

**Autre**
- Le comportement du champ "Payment"/billing pour un compte Events n'a pas été comparé au legacy en détail (juste repris tel quel du pattern Bookings, ACCOUNT par défaut) — à vérifier si ça correspond vraiment à `clients.html`.
- Aucune vérification qu'un `email` dupliqué ou mal formé se comporte proprement (le back ne valide que `IsString`, pas de contrainte d'unicité vue dans `clients.service.ts` — à confirmer si c'est voulu).

## Environnement pour reprendre

Identique à Bookings — `docker compose up` depuis `cockpit-v2/` (services postgres/api/web), les deux bind-mountés en hot-reload. Le compte de dev créé cette session (`CI2` "Sophie Martin") est une vraie course de test dans la DB de dev, pas un problème à nettoyer (cohérent avec le reste des données de démo accumulées).

**Prochaine étape concrète recommandée** : dans l'ordre, (1) vérifier au navigateur les chemins jamais exercés ci-dessus (édition, désactivation, Company/Events, filtres) et corriger ce qui casse, (2) écrire les tests Vitest sur `client-form-schema.ts`/`client-status.ts` en suivant exactement le pattern de `trip-form-schema.test.ts`/`trip-status.test.ts`, (3) au moins une spec Playwright nominale + une RBAC sur `client:edit`.
