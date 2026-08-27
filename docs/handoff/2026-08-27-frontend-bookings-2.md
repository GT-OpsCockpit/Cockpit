# Handoff — Frontend Cockpit v2, verticale Login + Bookings (suite)

> Continue `2026-08-27-frontend-bookings.md` (même journée, reprise directe). Voir aussi `docs/FRONTEND_PLAN.md` (Journal).

**Session du** : 2026-08-27
**Portée** : reprise immédiate recommandée par le handoff précédent — brancher `trip-form-fields.tsx`, construire la barre de création, puis les tableaux Local/Farm out + filtres.

---

## Où on en est en une phrase

La verticale Bookings couvre maintenant tout le cycle create → list/filter → edit → dispatch, **vérifié au navigateur réel** de bout en bout (dialog d'édition avec réassignation driver/vehicle/regnbr, et un vrai système de permissions RBAC backend+frontend qui gate le changement de prix/l'édition d'une course passée — voir `docs/agents/permissions.md`). Restent : dialogs d'annulation/validation d'étape, upload nameboard, et toute la suite de tests.

---

## Fait et vérifié (tsc + navigateur + curl)

### 1. `trip-form-fields.tsx` branché (item "Pas commencé" #1)

Contrairement à ce que redoutait le handoff précédent, `pnpm exec tsc -b --force` passait déjà sans erreur sur ce fichier tel quel. Le vrai problème de types est apparu seulement après avoir écrit le formulaire autour (`useForm<TripFormValues>` + `zodResolver`) : Zod v4 change `z.coerce.*` pour avoir un type d'input `unknown` (pas `string` comme en v3), et `.default()` rend le champ optionnel côté input — les deux cassent l'inférence RHF/Zod quand `useForm` est typé explicitement sur le type de sortie. Vérifié via context7 (`/colinhacks/zod` changelog v4, `/react-hook-form/resolvers`).

**Fix appliqué dans `trip-form-schema.ts`** : suppression de `z.coerce.number()` → `z.number()` simple, et suppression des `.default()` (`area`, `subContractor`, `tracking`) — les valeurs par défaut réelles viennent de toute façon de `tripFormDefaults()`, pas du schéma. Contrepartie dans `trip-form-fields.tsx` : les `<Input type="number">` (`paxCount`, `bufferTime`, `priceEur`, `partnerRateEur`) font maintenant la conversion string→number à la main via `e.target.valueAsNumber` dans `onChange` (empty string → `undefined`, pas `0` — bug latent évité : `Number('') === 0`, donc l'ancien code aurait silencieusement envoyé `0` pour un champ optionnel laissé vide).

### 2. `apps/web/src/features/bookings/booking-creation-bar.tsx` (nouveau, item #2)

Wrapper autour de `TripFormFields` : RHF + zodResolver, brouillon `localStorage` (clé `newBookingDraft`, sauvegardé via `form.watch()` en `useEffect`, restauré au montage, effacé après création réussie — vérifié en navigateur : remplir un champ, reload, le champ est toujours là). Deux boutons :
- **Create** : ne câble jamais driver/véhicule (sauf `subContractor` déjà coché, gardé tel quel) — logique identique au legacy (`dispatcher.html` L4356-4371).
- **Create & Dispatch** : activé seulement si (driver + fleetRegNbr) XOR (subContractor + partnerRef), désactivé si les deux à la fois (conflit) — reproduit `refreshDispatchButtonState()` du legacy (`common.js` L1086-1108).

Convertit `pickupDate` + `pickupTime` + `pickupTimezone` (résolu depuis le pays choisi) en `pickupAt` ISO via luxon. Vérifié en navigateur bout-en-bout : course créée (`R-CI1-26-1`), `pickupAt` UTC correct (14:30 Europe/Paris → `12:30:00Z`, DST compris), toast succès, formulaire reseté, cache trips invalidé.

`<Toaster />` (shadcn/sonner) monté dans `App.tsx` — n'existait pas encore.

### 3. Tableaux Local/Farm out + barre de filtres (item #3)

- `trip-status.ts` complété : `periodMatches`, `defaultBookingFilters`/`applyBookingFilters` (reproduit `renderTrips()` L442-463 de `dispatcher.html` — recherche sur ref/compte/passager/chauffeur seulement, **pas** sur PU/DO, comportement vérifié volontairement fidèle au legacy), `isEventClientTrip`, `clientAccountLabel`, `tripDriverName`, `dispatchButtonState` (reproduit `dispatchActionButtonHtml`, `common.js` L2536-2551 : grisé tant que driver+véhicule pas les deux assignés en Local non-sous-traité, `disabled` si déjà `dispatched`).
- `status-badge.tsx` (nouveau) : badge plein pour les steps "highlighted" (Sent/Received/Confirmed/Done/Stop), texte coloré simple sinon — couleurs reprises de `style.css` L482-498.
- `booking-filters-bar.tsx` (nouveau) : search, period (upcoming/today/week/past/all), client, driver, passenger, vehicle, service — tous des `Select`/`Input` shadcn, pas de combobox recherchable ici (le legacy non plus).
- `bookings-table.tsx` (nouveau) : une table réutilisée pour `variant="local"|"farmout"` (colonne Reg Nbr seulement en Local). Colonnes identiques au legacy. **Simplification consciente** : les popups de réassignation rapide au clic sur une cellule (Driver/Vehicle/RegNbr/Account/Passenger dans le legacy) ne sont **pas** repris — cellules en lecture seule pour l'instant ; la réassignation passera par le dialog d'édition (item #4, pas encore fait). Pas mentionné explicitement dans la liste "Pas commencé" d'origine, donc traité comme une simplification du même ordre que celles déjà actées pour la barre de création.
- `dispatch-confirm-dialog.tsx` (nouveau) : AlertDialog "Dispatch to the driver?" — complète une bonne partie de l'item #7 (le bouton grisé + le dialog de confirmation existent ; il ne manque que la gestion des cas "manquant" qui ouvraient des quick-popups dans le legacy, cf. simplification ci-dessus).
- `bookings-page.tsx` : assemble tout, + **`useTripEvents()` câblé (item #9)** — vérifié en navigateur : un `dispatch-driver` déclenché via curl (donc depuis "l'extérieur") met à jour la ligne du tableau (badge "Sent ✅", driver "Karim H.") **sans aucun reload**, confirmant que l'invalidation SSE fonctionne de bout en bout.

Vérifié en navigateur : split Local/Farm out correct (course FR/Nice → Local, course DE/Berlin → Farm out), tri par pickup, filtre recherche (positif sur "Farmout" dans le nom passager, négatif sur "Berlin" qui n'est dans aucun champ recherché — comportement voulu), dispatch avec driver manquant → 400 serveur propre → toast d'erreur avec le message API (`"No driver or partner assigned to this trip."`).

---

## Bugs trouvés et corrigés au passage (pas dans le scope initial, mais bloquants)

1. **`search-combobox.tsx`** — cmdk filtre sur la prop `value` de `Command.Item`, qui valait le code brut de l'option (ex. `"FR"`) au lieu de son label affiché. Taper "France" dans le combobox Country ne matchait donc jamais rien ("No results" alors que l'option existe). Fix : `value={option.label}` (la sélection, elle, utilise déjà la closure `option.value`, pas l'argument du callback `onSelect`). Confirmé contre la doc cmdk via context7 (le filtre matche `value` + `keywords`, jamais les children rendus).
2. **Base de données dev vide** — `docker compose ps` montrait la stack up, mais `clients`/`drivers` étaient à 0 malgré ce qu'affirmait le handoff précédent (2 clients/3 drivers/2 véhicules attendus). Reseedé manuellement : `cd apps/api && pnpm exec tsx prisma/seed.ts` (charge `.env` via `dotenv/config`, comme `test:e2e:prepare` mais sur la DB dev). Pas de script npm dédié pour ça en dev — seulement `test:e2e:prepare` qui vise `.env.test`. À surveiller si ça se reproduit (volume Docker recréé entre sessions ?).
3. **Inputs qui se superposent dans les lignes "Driver / Reg Nbr" et "Sub-contracted / Partner"** (signalé par l'utilisateur, repéré aux DevTools sur le dialog d'édition — invisible côté barre de création parce que "Driver…" y est court, alors que l'édition préremplit un vrai nom type "Karim Haddad (D-FR-INT-001)"). Double bug CSS Grid/Flexbox classique, deux niveaux :
   - `FormItem` (`apps/web/src/components/ui/form.tsx`) est un `<div className="grid gap-2">` sans `min-width:0` — par défaut un enfant de grid ne rétrécit jamais sous la taille intrinsèque (min-content) de son contenu, donc dans une rangée `grid-cols-4`, un champ au texte long débordait sur la colonne suivante malgré des colonnes de largeur égale. Fix : `"grid min-w-0 gap-2"`.
   - Même chose un niveau plus bas dans `search-combobox.tsx` : le bouton trigger (`w-full` seul) et le `<span className="truncate">` à l'intérieur souffraient du même défaut (`min-width:auto` par défaut sur un enfant flex empêche `truncate`/l'ellipse de jouer, et empêche le bouton de rétrécir sous son propre contenu malgré `w-full`). Fix : `min-w-0` ajouté sur le bouton ET sur le span tronqué — sans les deux, le premier `min-w-0` (sur `FormItem`) ne suffit pas, le débordement se déplace juste d'un niveau plus bas dans l'arbre DOM.
   
   Correctif appliqué à la racine (composants partagés shadcn, pas un patch localisé à Bookings) — corrige donc potentiellement le même bug ailleurs dans l'app où `FormItem`/`SearchCombobox` afficherait un texte long dans une grille étroite. Vérifié aux DevTools (`getBoundingClientRect()` avant/après) + au navigateur sur les 3 endroits concernés du dialog d'édition (Driver/Reg Nbr, Partner, Customer) : plus aucun chevauchement, troncature avec ellipse propre.

---

## Fait et vérifié dans cette reprise (tsc + navigateur + curl)

### 4. Dialog d'édition complète (item #4) ✅

- **Bug bloquant trouvé et corrigé avant de pouvoir commencer** : `UpdateTripDto` (`apps/api/src/trips/dto/update-trip.dto.ts`) faisait `OmitType(CreateTripDto, [...])` en important `OmitType` depuis `@nestjs/mapped-types` au lieu de `@nestjs/swagger`. Résultat : le plugin CLI Swagger (`classValidatorShim`) ne recopiait pas les métadonnées `@ApiProperty` héritées de `CreateTripDto`, donc le spec OpenAPI — et donc le client généré dans `packages/shared` — ne voyait que le champ `notifyDriver` sur `UpdateTripDto`, alors que l'endpoint accepte réellement tous les champs (vérifié en lisant le contrôleur/DTO source, confirmé via context7 sur `/nestjs/swagger`). Même bug trouvé par grep dans `update-client.dto.ts` et `update-vehicle-type.dto.ts` (`PartialType` depuis `@nestjs/mapped-types`) — corrigés en même temps par cohérence, même si aucun dialog front ne les utilise encore. Après fix : `pnpm api:generate` (API dev déjà up, hot-reload nest a pris le changement), vérifié via `curl .../api/docs-json` que `UpdateTripDto` expose bien tous les champs, puis `tsc -b --force` propre.
- `trip-form-mapping.ts` (nouveau) : `toPickupAt` déplacé ici depuis `booking-creation-bar.tsx` (partagé), + `tripToFormValues(trip)` (inverse — préremplit le formulaire depuis un `TripEntity`, réutilise `pickupLocalInstant` de `trip-status.ts`).
- `booking-edit-dialog.tsx` (nouveau) : `Dialog` shadcn autour de `TripFormFields` réutilisé tel quel (mêmes champs qu'à la création, y compris driver/fleetRegNbr/subContractor/partnerRef — **contrairement au legacy** dont le popup d'édition n'exposait pas la réassignation véhicule/driver, décision déjà actée dans la session précédente puisque les quick-popups de réassignation ont été sautées). `useForm({ values: trip ? tripToFormValues(trip) : tripFormDefaults() })` — le pattern RHF documenté (confirmé via context7 sur `/react-hook-form/documentation`) pour synchroniser un formulaire sur une prop externe qui change (ouverture du dialog sur une ligne différente = reset propre, pas de fuite de brouillon entre deux courses).
- **Fidélité legacy sur `notifyDriver`** : ce n'est **pas** une checkbox dans le formulaire (elle n'existe pas dans `trip-form-fields.tsx`) — exactement comme `openEditTripModal` dans `common.js` (L3188-3280 du legacy), c'est calculé automatiquement à `!!trip.driver` au moment où le dialog s'ouvre (snapshot), et le bouton de confirmation affiche "Confirm and send" ou "Confirm" en conséquence. Vérifié en navigateur sur les deux courses de test : `R-CI1-26-1` (déjà dispatché à Karim) → "Confirm and send", payload PUT avec `notifyDriver:true` ; `R-CI1-26-2` (pas de driver) → "Confirm" (pas soumis, juste vérifié le libellé).
- Vérifié en navigateur bout-en-bout sur `R-CI1-26-1` : ouverture du dialog → tous les champs préremplis correctement (pays, date/heure locale, driver, Reg Nbr, etc.), modification du nom passager + ajout d'un type de véhicule (la course de seed n'en avait pas — révèle un trou dans les données de seed, pas un bug), soumission → toast succès, dialog fermé, **tableau mis à jour sans reload** (cache TanStack Query invalidé), payload PUT confirmé complet via DevTools Network (tous les champs, pas seulement `notifyDriver`).
- **Gap identifié à la fin de cette passe (comblé juste après, voir §5) :** `openEditTripModal` (legacy) bloque la modification du Retail net / Partner rate net, ou de toute course déjà passée, derrière le mot de passe manager (`promptAdminPassword`). Non traité dans un premier temps ici — voir la section suivante, qui remplace entièrement l'approche envisagée (mot de passe manager) par un vrai système de rôles.

### 5. Système de permissions (RBAC) — remplace l'approche "mot de passe manager" envisagée ✅

Demande explicite de l'utilisateur en cours de session (pas dans le scope initial de l'item #5) : un vrai système de droits, backend + frontend, généralisable à d'autres features, bien documenté pour les futurs agents — plutôt que de porter tel quel le `promptAdminPassword` du legacy. Session de grilling (`/mattpocock-skills:grill-me`) pour caler l'architecture avant d'implémenter. Décisions actées : RBAC pur sur la session déjà authentifiée (pas de re-saisie de mot de passe — le legacy ne le faisait que parce qu'il n'avait qu'un seul compte partagé, ce qui n'est plus le cas), permissions nommées (pas juste des rôles bruts éparpillés dans le code), mapping rôle→permission statique dans le code (pas en DB — seule l'assignation d'un rôle à un `User` reste en DB, déjà le cas), branché immédiatement sur tout ce qui existe déjà côté v2 (Bookings), le reste documenté pour plus tard.

**Découverte utile en cours de recherche** : `Role` (ADMIN/DISPATCHER), `SessionAuthGuard`, `@CurrentUser()`, et même un `RolesGuard`/`@Roles()` existaient déjà côté API (posés dès le cadrage backend initial, cf. `docs/BACKEND_PLAN.md`) et étaient déjà branchés sur `UsersController`/`CompanyController`. Ce chantier généralise ce mécanisme plutôt que d'en inventer un nouveau.

**Livré** (détail complet, table de correspondance avec chaque gate legacy, et guide pour brancher une nouvelle permission : **`docs/agents/permissions.md`**, à lire avant toute nouvelle feature "Admin only") :
- `apps/api/src/common/permissions/permissions.ts` — carte statique `Permission -> Role[]`, `can(user, permission)`.
- `@RequirePermission()` + `PermissionsGuard` remplacent `@Roles()`/`RolesGuard` (supprimés) — `UsersController`/`CompanyController` migrés.
- `TripsController.cancelAssignment` gaté (`trip:cancel`, inconditionnel) ; `TripsService.update()` gate conditionnellement (`trip:edit-past`, `trip:edit-price`) — comble exactement le gap noté au §4.
- `GET /auth/me` renvoie `permissions: Permission[]` (résolu côté serveur) — seul canal par lequel le frontend connaît ses droits.
- `POST /api/auth/verify-password` **supprimé** (devenu inutile avec le RBAC pur — decision utilisateur explicite).
- Frontend : `apps/web/src/features/auth/use-permission.ts` (`usePermission()`), branché dans `booking-edit-dialog.tsx` — formulaire entièrement désactivé (native `<fieldset disabled>`) + bandeau d'avertissement si course passée et rôle insuffisant, sinon juste les champs Retail net/Partner rate net désactivés avec message explicatif.
- **Vérifié en navigateur** avec un vrai compte DISPATCHER créé pour le test (`dana@cockpit.local` / `dispatcher-pass-123`, laissé en DB — voir plus bas) : formulaire grisé + bandeau sur une course passée, seul le champ prix grisé sur une course future, bouton Confirm désactivé en conséquence. Vérifié aussi côté API : suite e2e dédiée `apps/api/test/permissions.e2e-spec.ts` (5 tests, DISPATCHER bloqué/ADMIN autorisé sur chaque gate) + suite complète (88 tests, 13 fichiers) toujours verte après la migration `@Roles` → `@RequirePermission`.
- **Non fait** : le dialog d'annulation (item #6 ci-dessous, jamais commencé) devra utiliser `usePermission('trip:cancel')` de la même façon — le backend l'impose déjà indépendamment (`cancelAssignment` gaté), donc pas de trou de sécurité en attendant, juste un bouton "Cancel" qui n'est pas encore branché à l'API du tout (`notImplemented` dans `bookings-page.tsx`).

## Pas commencé (mis à jour depuis cette reprise)

1. ~~Finir/vérifier/type-checker `trip-form-fields.tsx` et le brancher.~~ ✅
2. ~~Composant "barre de création" — persistance brouillon, Create / Create & Dispatch.~~ ✅
3. ~~Tableaux Local/Farm out + barre de filtres.~~ ✅ (sans les quick-popups de réassignation — voir simplification ci-dessus)
4. ~~Dialog d'édition complète.~~ ✅ — le gate prix/course-passée est maintenant couvert (§5, RBAC), plus besoin de mot de passe manager.
5. ~~Système de permissions (RBAC).~~ ✅ — voir §5. Remplace l'approche "mot de passe manager" qui était prévue ici à l'origine.
6. Dialog "Valider l'étape ?" (`POST /api/trips/:ref/advance-step`), déclenché par clic sur le badge de statut si `isStatusAdvanceable` (le badge n'est pour l'instant pas cliquable dans `status-badge.tsx` — à ajouter avec ce dialog).
7. Dialog de dispatch : **le gros est fait** (bouton grisé selon `dispatchButtonState`, `AlertDialog` de confirmation, appel `dispatch-driver`, toast succès/erreur). Reste seulement le cas "driver/véhicule manquant" qui, dans le legacy, ouvrait un quick-popup — pour l'instant le clic appelle quand même `onDispatch` et laisse le serveur renvoyer une 400 propre (affichée en toast). À revisiter si cette UX est jugée insuffisante une fois le dialog d'édition (#4) en place.
8. Upload nameboard (`POST /api/trips/:ref/nameboard`, multipart) — rien commencé.
9. ~~Wiring `useTripEvents()` dans `bookings-page.tsx`.~~ ✅ — vérifié en navigateur (mise à jour live sans reload).
10. Tests — toujours rien écrit, Playwright toujours pas installé.
11. Vérification manuelle complète au navigateur du parcours bout-en-bout une fois tout branché (édition, annulation, avance de statut, upload restent à faire avant ce passage complet).

Données de test laissées en DB dev pour la prochaine session (utiles, pas besoin de les supprimer) :
- `R-CI1-26-1` (Local, FR/Nice, dispatché à Karim Haddad, pax renommé "Sophie Durand-Edited" et véhicule "Business" ajouté via le dialog d'édition).
- `R-CI1-26-2` (Farm out, DE/Berlin, pas encore assigné).
- `R-CI1-26-3` (Local, FR/Nice, pickup **2026-01-01 — volontairement dans le passé**, créée pour vérifier au navigateur le gate `trip:edit-past`) — utile pour retester la verticale permissions sans avoir à en recréer une.
- Compte `dana@cockpit.local` / `dispatcher-pass-123` (rôle DISPATCHER) — créé pour tester le RBAC côté navigateur ; seul compte non-admin du dev actuellement, pratique pour retester rapidement n'importe quel gate `usePermission`/`@RequirePermission` à l'avenir.

---

## Environnement pour reprendre

Inchangé depuis le handoff précédent, sauf :
- **Reseed nécessaire si `GET /api/clients` renvoie `[]`** : `cd apps/api && pnpm exec tsx prisma/seed.ts` (l'API et postgres doivent déjà être up).
- Identifiants dev toujours dans `apps/api/.env` (`ADMIN_EMAIL`/`ADMIN_PASSWORD`, `AUTH_DEV_OTP=true`).
- Le client généré `packages/shared/src/api` a été régénéré deux fois dans cette session (`pnpm --filter web api:generate`, API dev up requise) : une fois pour le fix `UpdateTripDto`/`UpdateClientDto`/`UpdateVehicleTypeDto`, une seconde fois pour `AuthMeEntity.permissions` + la suppression de `verify-password`. Rien à refaire, juste savoir que c'est la commande si un DTO API change à l'avenir et que le client semble à côté de la plaque.
- Lire `docs/agents/permissions.md` avant toute nouvelle feature "Admin only" — le système de permissions (§5 ci-dessus) est désormais la seule façon de gater une action, `promptAdminPassword`/`verify-password` n'existent plus.

**Première étape concrète recommandée** : dialog d'annulation (item #6 ci-dessus, jamais commencé — le bouton "Cancel" appelle encore `notImplemented`). Câbler `POST /api/trips/:ref/cancel-assignment` (déjà gaté côté API par `trip:cancel`, voir §5) + `usePermission('trip:cancel')` côté front pour désactiver/masquer le bouton avant même d'essayer, sur le même modèle que `booking-edit-dialog.tsx`. Pas besoin de mot de passe manager ni de composant de prompt — le rôle de la session déjà connectée suffit.
