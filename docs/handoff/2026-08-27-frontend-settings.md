# Handoff — Cockpit v2, verticale `/settings`

> Suite de `2026-08-27-frontend-invoicing.md`. `/settings` était l'une des dernières pages authentifiées listées dans `docs/FRONTEND_PLAN.md`, restait après elle : `/finance` (stub), plus les deux pages publiques `/driver/:ref` et `/track/:ref`.

**Session du** : 2026-08-27

## Contexte

Le back (`apps/api/src/users/`, `apps/api/src/company/`) était déjà entièrement construit lors d'une session précédente — `UsersController` (`GET/POST /users`, `PUT /users/:id`, `PATCH /users/:id/deactivate`, gardé par `user:manage`) et `CompanyController` (`GET/PUT /company-info`, gardé par `company:edit`). Client API déjà généré (`packages/shared/src/api/endpoints/{users,company}/`). Cette session est donc entièrement de la **composition front**, sans aucun ajout backend — même schéma que la session Invoicing.

En tout début de session, l'utilisateur a demandé l'ajout manuel d'un compte Admin (`rmnheo@gmail.com`) — fait via `POST /api/users` (le vrai endpoint, authentifié en tant qu'admin de dev), pas d'écriture directe en base.

### Décision de cadrage sur le lock de Company info

`PUT /company-info` verrouille définitivement après le premier succès (`company.service.ts` lève `ConflictException` dès que `saved` est `true`) — il n'existe **aucun endpoint de déverrouillage** côté v2, contrairement au legacy qui proposait un re-edit via crayon + re-prompt de mot de passe (`owner.html:270-278`). Plutôt que de contourner cette limite côté front, le Company tab l'assume : formulaire de création tant que non sauvegardé, puis vue lecture-seule permanente avec un badge "Locked" — aucune UI de re-édition. Ce point a été volontairement documenté comme un gap accepté, pas un bug.

## Ce qui a changé

### Aucun changement backend

Tout l'existant (`apps/api/src/users/`, `apps/api/src/company/`) a été réutilisé tel quel.

### Front — nouveau dossier `apps/web/src/features/settings/`

- `settings-page.tsx` — composition en `Tabs` (shadcn), deux onglets : Company / Users, même mécanique que `invoicing-page.tsx`.
- `company-form-schema.ts`/`.test.ts` — mirroir exact de `UpdateCompanyInfoDto` (13 champs `@IsNotEmpty()`, aucune validation de format email contrairement à `client-form-schema.ts` — le back n'en a jamais eu non plus sur ces champs), `companyFormDefaults()`.
- `company-form-mapping.ts` — `toUpdateCompanyInfoDto()` uniquement ; pas de mapping entité→formulaire (pas de cas de pré-remplissage puisqu'il n'y a jamais d'édition).
- `company-form-fields.tsx` — les 13 champs, `countryCode` via `SearchCombobox` (même pattern que `driver-form-fields.tsx`).
- `company-tab.tsx` — `usePermission('company:edit')` ; la query `useCompanyControllerGet` est `enabled: canEdit` (le GET est lui-même gardé côté back, contrairement à `client:edit` qui ne garde que la mutation — donc pas de fetch du tout pour un DISPATCHER, sinon 403 immédiat). Branche sur `data.saved` : formulaire de création si `false`, vue lecture-seule + badge "Locked" si `true`.
- `user-form-schema.ts` — deux schémas distincts : `userCreateFormSchema` (mirroir de `CreateUserDto`, avec `password` min 8 via `z.string().min(8, ...)`) et `userEditFormSchema` (mirroir de `UpdateUserDto`, **sans** `password` — le champ n'existe pas côté update, un utilisateur ne peut définir son mot de passe qu'à la création). Email validé via `isValidEmail` de `@cockpit/shared` (même mirroir de `class-validator`'s `IsEmail` que `client-form-schema.ts`).
- `user-form-mapping.ts`, `user-form-fields.tsx` — champs communs create/edit (Surname/Name/Email/Mobile/Role) factorisés dans un composant générique `UserFormFields<T extends CommonUserFields>` ; le champ Password n'est rendu que dans `user-create-dialog.tsx` (pas dans le composant partagé, puisque le type du formulaire d'édition ne l'a pas).
- `user-create-dialog.tsx`, `user-edit-dialog.tsx` — même mécanique que `driver-create-dialog.tsx`/`driver-edit-dialog.tsx` (React Hook Form + zodResolver, `values:` pour l'édition pour re-synchroniser sur la cible).
- `users-table.tsx` — colonnes Ref/Surname/Name/Mobile/Email/Role/Activated (avec date de désactivation en rouge)/Action ; Edit et Deactivate désactivés si `!active || !canManage`.
- `users-tab.tsx` — liste + create dialog + edit dialog + confirmation de désactivation via `AlertDialog`. La désactivation est **irréversible** côté v2 : il n'existe aucun endpoint de réactivation pour les users (contrairement aux drivers/vehicles), donc contrairement à `drivers-page.tsx` (toggle inline sans confirmation), ici un `AlertDialog` explicite prévient que l'action ne peut pas être annulée.
- `test-fixtures.ts` — `baseCompanyInfo()`, `baseUser()`.
- `router.tsx`/`app-shell.tsx` — route + entrée nav `/settings`, après Invoicing. Visible pour tout utilisateur connecté (aucun gate au niveau nav dans l'app aujourd'hui) — un DISPATCHER voit le lien mais chaque onglet affiche un état vide "requires the Admin role" sans jamais déclencher la query GET.

## Tests

- **Frontend unit** : `company-form-schema.test.ts` (all-or-nothing, pas de validation de format), `user-form-schema.test.ts` (min-8 password, format email, absence de password sur l'édition), `users-table.test.tsx` (rendu, désactivation des actions selon `active`/`canManage`, callbacks).
- **Playwright** : `settings-company-lifecycle.spec.ts` (crée l'info société une fois si pas déjà fait — l'API est interrogée d'abord pour rendre le test idempotent malgré le lock global qui survit aux reruns locaux avec `reuseExistingServer` — vérifie le lock, un retry PUT direct en 409, persistance après reload), `settings-users-lifecycle.spec.ts` (create avec password, validation client-side du password court, edit avec changement de rôle, deactivate avec confirmation irréversible, actions désactivées ensuite), `settings-rbac.spec.ts` (DISPATCHER : état vide sur les deux onglets, aucune query déclenchée, 403 direct sur `GET /company-info` et `GET /users`).

## Résultats finaux

- `pnpm --filter @cockpit/api test` → **27/27** (inchangé, aucun test backend ajouté)
- `pnpm --filter @cockpit/web test` → **267/267** (+33 vs session précédente)
- `pnpm --filter @cockpit/web exec tsc --noEmit -p tsconfig.app.json` → propre
- `pnpm --filter @cockpit/web lint` → 8 warnings, tous préexistants (même baseline que les sessions précédentes)
- `pnpm --filter @cockpit/web exec playwright test` → **24/24** (+3)
- Vérification manuelle au navigateur (chrome-devtools MCP) sur `/settings` : création de l'info société, verrouillage confirmé après reload, création/édition (changement de rôle)/désactivation d'un user de test. Aucune erreur console (hors le warning `HydrateFallback` préexistant, sans rapport).

## Environnement pour reprendre

`docker compose` (dev, 5173/3000) up, aucun rebuild nécessaire (aucune nouvelle dépendance cette session).

Données laissées dans la base dev (non nettoyées, cohérent avec les sessions précédentes) :
- Info société sauvegardée (verrouillée définitivement — voir "Décision de cadrage" ci-dessus) pour l'environnement dev.
- Compte Admin `rmnheo@gmail.com` créé en tout début de session (demande explicite de l'utilisateur).
- Un user de test `test.e2emanual@cockpit.test` créé puis désactivé pendant la vérification navigateur.

**Prochaine étape suggérée** : au choix entre `/finance` (stub) ou les deux pages publiques `/driver/:ref`/`/track/:ref` — voir `docs/FRONTEND_PLAN.md`.
