# Cockpit v2 — Refonte visuelle du kit UI (apps/web)

> Document vivant : la section "État actuel" est la version en vigueur. Tout changement de cap s'ajoute au **Journal** en bas, jamais en réécrivant l'historique. Voir aussi `FRONTEND_PLAN.md` pour le plan frontend général — ce document ne couvre que le rafraîchissement visuel du kit UI existant (pas de nouvelle page, pas de changement de layout).

## Contexte de décision

Session de design (2026-08-27) : le kit UI shadcn/Tailwind en place (voir `FRONTEND_PLAN.md`) était jugé "dramatique" — pas de police custom (fallback système), accent vert délavé, radius plat, pas d'icônes, badges de statut en couleurs Tailwind brutes codées en dur, et des transitions Radix déjà présentes dans le markup mais inertes faute de plugin.

Deux allers-retours de maquette avec l'utilisateur (comparaison "existant / proposition", inspirée du preset shadcn "Rhea" — mesuré en live sur `ui.shadcn.com/create?preset=b27GcrRo` : Inter, boutons ~32px/18px de radius soit quasi plein, cards à 24px de radius) ont abouti à une direction validée, avec un correctif : le radius "pilule" plein testé en premier était jugé excessif sur boutons/inputs → **arrondi modéré (~10-12px)** retenu à la place. Layout des pages inchangé sur toute la démarche.

## Proposition retenue

- **Radius** : modéré partout (boutons/inputs ~10px, dialogs ~12px, cards ~16px) via un seul token, PAS de pilule sur boutons/inputs. Les badges de statut restent en pill complet (`rounded-full`, déjà le cas) — c'est volontairement la seule pièce du kit en pilule, pour les distinguer visuellement.
- **Typographie** : Inter (self-hosted, `@fontsource-variable/inter`) au lieu du fallback système.
- **Accent** : vert plus saturé/contrasté (`oklch(0.48 0.13 165)` env.) au lieu du vert délavé actuel — garde l'héritage WhatsApp du legacy sans avoir l'air terne.
- **Icônes** : `lucide-react` (déjà une dépendance, même lib que le preset Rhea) en nav, boutons d'action, badges de statut, et 2 champs de formulaire (Pickup address, Pickup time).
- **Badges de statut** : pill-outline (fond clair, bordure + texte de la couleur du statut) + icône par step, remplaçant le badge plein solide + emoji actuels.
- **Animations** : activation des transitions Radix déjà câblées dans le markup (dropdown, popover, select, dialog) mais inertes faute de plugin Tailwind — ajout de `tw-animate-css`.
- **Overlay & surfaces flottantes** : fond de dialog/alert-dialog flouté (`backdrop-blur`) au lieu d'un simple assombrissement plat ; contenu des surfaces flottantes (dialog, alert-dialog, dropdown-menu, popover, select) en `ring` léger plutôt qu'en bordure classique — style mesuré en direct sur `ui.shadcn.com/docs/components/base/alert-dialog` (composants "base" de shadcn, appréciés par l'utilisateur).
- **États de chargement** : l'app n'a aujourd'hui aucun indicateur de chargement (constat détaillé au point 8) — ajout de skeletons sur les listes et de spinners sur les boutons d'action, dans le même chantier.

Maquette de référence (artefact Claude, comparaison avant/après + démo de transition) : `https://claude.ai/code/artifact/2d7758a8-9e25-4572-881c-043a23888081`.

## Plan d'implémentation (vérifié réalisable — voir Journal pour le détail de l'analyse)

### 1. Radius — un seul token
`apps/web/src/index.css` : `--radius: 0.625rem` → `--radius: 0.75rem`. Comme `--radius-sm/md/lg/xl` dérivent de `--radius` dans `@theme inline`, ça suffit pour boutons/inputs/selects/dropdown/popover (`rounded-md` : 8px→10px), dialogs/tabs (`rounded-lg` : 10px→12px), cards (`rounded-xl` : 14px→16px). Aucun composant à toucher.

### 2. Typographie
- `apps/web/package.json` : + `@fontsource-variable/inter` (dependency)
- `apps/web/src/main.tsx` : `import '@fontsource-variable/inter'`
- `apps/web/src/index.css` : `body { font-family: 'Inter Variable', 'Inter', ui-sans-serif, system-ui, sans-serif; }`

### 3. Accent
`apps/web/src/index.css` : `--primary`/`--accent`/`--accent-foreground`/`--ring` vers `oklch(0.48 0.13 165)` (et variante claire pour `--accent`).

### 4. Icônes
- **Nav** (`app-shell.tsx`) : icône par lien (Calendar/Bookings, Users/Clients, Car/Drivers, Truck/Vehicles, CalendarClock/Planning).
- **Boutons** : `Button` supporte déjà nativement une icône enfant (`[&_svg:not([class*='size-'])]:size-4` dans `button.tsx`) — vérifié trivial sur `booking-creation-bar.tsx` (Create / Create & Dispatch). **Attention** : `bookings-table.tsx` a déjà des icônes sur les boutons Edit/Cancel (`size="icon"`) — vérifier leur contenu actuel avant d'ajouter quoi que ce soit, pour ne pas dupliquer.
- **Champs de formulaire** — **correction suite à l'analyse de code** : sur les 3 champs visés, seuls **Pickup address** et **Pickup time** (`trip-form-fields.tsx`) sont de vrais `<Input>` (dans `FormControl`/`Slot.Root`, qui exige un seul enfant ref-forwardant). **Customer** est en réalité un `SearchCombobox` (`components/search-combobox.tsx`), pas un `Input` — l'icône pour ce champ doit être ajoutée dans `SearchCombobox` lui-même (à vérifier s'il n'en a pas déjà une, cmdk en fournit souvent une par défaut), pas dans `Input`.
  - **Ne pas modifier `input.tsx`** (utilisé nu dans ~25+ endroits via `Slot.Root`, un wrapper `<div>` casserait le pattern `React.Children.only`). **Correction (au lieu d'un composant maison) : utiliser le composant officiel `InputGroup`** de shadcn (`pnpm dlx shadcn@latest add input-group`) — conçu exactement pour ça (`InputGroup` + `InputGroupInput` + `InputGroupAddon align="inline-start"` pour une icône avant le champ), aux 2 call sites concernés, passé comme enfant unique de `FormControl`. Zéro composant custom à écrire/maintenir.

### 5. Badges de statut — pill-outline + icône
`trip-status.ts` (labels) + `status-badge.tsx` (rendu) : retirer les emoji de `STEP_LABELS`/`CANCELLED_LABEL`/le `'📤 Send ?'` inline, les remplacer par une icône lucide rendue à côté du texte ; remplacer les classes Tailwind brutes (`HIGHLIGHTED_COLORS`/`PLAIN_COLORS`, ex. `bg-emerald-100 text-emerald-800`) par un style pill-outline cohérent avec les tokens du thème.

| Step | Emoji actuel | Icône lucide |
|---|---|---|
| TRANSMITTED (Sent) | 📤 | `Send` |
| RECEIVED | 📥 | `Inbox` |
| ACCEPTED (Confirmed) | ✔️ | `CheckCircle2` |
| ENROUTE (OTW) | 🛣️ | `Navigation` |
| ARRIVED (IP) | 📍 | `MapPin` |
| ONBOARD (POB) | 🟢 | `UserCheck` |
| DROPPED (Done) | ✅ | `CheckCheck` |
| CANCELLED (Stop) | 🛑 | `XCircle` |

**Impact test — obligatoire, pas optionnel** : `apps/web/src/features/bookings/status-badge.test.tsx` fait 7 assertions en `getByText('📤 Send ?')` / `getByText('🛑 Stop')` / `getByRole('button', { name: '📤 Sent ✅' })` etc. (lignes 14, 23, 32, 42, 52, 67, 77). Elles casseront dès que l'emoji sort du texte pour devenir une icône séparée — à réécrire en même temps que le composant (matcher sur le texte sans emoji, ou ajouter un `aria-label`/rôle explicite).

**Hors scope explicite** (à traiter séparément si voulu) : d'autres emoji du même style existent dans `trip-form-fields.tsx` (`📅 Date`, `PU 🕐`, `📍 PU`/`📍 DO`, `✅ Flight schedule matches...`) — pas touchés par cette itération.

### 6. Animations
- `apps/web/package.json` : + `tw-animate-css` (devDependency)
- `apps/web/src/index.css` : `@import "tw-animate-css";` juste après `@import "tailwindcss";`

Vérifié : `apps/web/vite.config.ts` n'utilise que `@tailwindcss/vite`, pas de `tailwind.config.js`/PostCSS legacy qui pourrait entrer en conflit — un `@import` simple fonctionne. Les classes `data-[state=open]:animate-in fade-in-0 zoom-in-95 ...` sont déjà présentes dans `dropdown-menu.tsx`, `popover.tsx`, `select.tsx`, `dialog.tsx`, `alert-dialog.tsx` mais actuellement mortes (Tailwind v4 core ne fournit pas ces utilitaires) — ce seul ajout les active partout sans toucher un composant.

### 7. Alignement sur le style shadcn "base" — vérifié composant par composant
Demande explicite : adopter le style de `ui.shadcn.com/docs/components/base/xxx` pour **chaque** composant du kit utilisé, pas seulement les dialogs. Vérification faite en mesurant les styles calculés en direct sur le site (pas en devinant depuis une seule page) :

**Clarification architecturale importante (à vérifier avant de foncer, faite ici)** : shadcn publie chaque composant "base" en 3 variantes d'implémentation — `docs/components/base/*` (primitives **Base UI**, `@base-ui-components/react`), `docs/components/radix/*` (primitives **Radix UI**, ce qu'on utilise déjà via le package `radix-ui`), et `docs/components/aria/*` (React Aria). Comparé `base/select` vs `radix/select` : le langage visuel (radius, ring vs border, ombre) est **identique dans les deux**, seule la lib headless sous-jacente change. **Conclusion : on peut prendre le look "base" sans changer de primitive ni ajouter `@base-ui-components/react`** — ce n'est que des classes Tailwind, applicables tel quel sur nos composants Radix existants. Zéro migration, zéro nouvelle dépendance.

**Mesures réelles (`getComputedStyle` sur les démos live du site) :**

| Composant | Radius | Bordure | Notes |
|---|---|---|---|
| Card | `rounded-xl` (14px) | `ring-1 ring-foreground/10` (pas de `border`) | pas d'ombre visible au-delà du ring |
| Alert Dialog / Dialog (content) | `rounded-xl` (14px) | `ring-1 ring-foreground/10` | `bg-popover`, padding resserré (`p-4` au lieu de `p-6`) |
| Alert Dialog / Dialog (overlay) | — | — | `bg-black/10` + `supports-backdrop-filter:backdrop-blur-xs`, transition ~100ms |
| Button (default/outline/secondary/ghost/destructive) | `rounded-lg` (10px) | `border` classique conservé | 32px de haut sur la démo — cohérent avec notre `--radius` déjà prévu au point 1, pas de pilule |
| Select (trigger) | `rounded-lg` (10px) | `border border-input` classique conservé | **pas de ring ici** — voir distinction ci-dessous |
| Select (content, panneau ouvert), Dropdown Menu (content), Popover (content) | `rounded-lg`/`rounded-xl` | `ring-1 ring-foreground/10` | même traitement que Card/Dialog |
| Badge | `rounded-full` | pas de bordure (sauf variant `outline`) | déjà notre traitement actuel, cohérent avec le point 5 |

**Règle qui en ressort, à appliquer partout** : le `ring` remplace la bordure sur les **surfaces/conteneurs flottants ou posés** (Card, contenu de Dialog/AlertDialog, contenu de DropdownMenu/Popover/Select-ouvert) ; les **contrôles interactifs** (Button, Input, Select-trigger, Textarea) gardent une bordure classique — ce n'est pas un ring générique appliqué à l'aveugle sur tout le kit.

**Changements concrets :**
- **Overlay** (`DialogOverlay`/`AlertDialogOverlay`) : `bg-black/50` → `bg-black/40` + `backdrop-blur-sm` (un peu plus contrasté que la référence `bg-black/10` pour rester lisible sur les écrans de dispatch). Transition déjà animée via `tw-animate-css` (point 6).
- **Contenu des surfaces flottantes** (`DialogContent`, `AlertDialogContent`, `dropdown-menu` content, `popover` content, `select` content) : `border` → `ring-1 ring-foreground/10`, garder `bg-popover`.
- **`card.tsx`** : même traitement — `rounded-xl border bg-card ... shadow-sm` → `rounded-xl ring-1 ring-foreground/10 bg-card` (retrait de l'ombre, elle n'apporte rien une fois le ring en place).
- **Boutons/inputs/select-trigger** : **ne pas** leur mettre de ring — ils gardent leur bordure classique, seul le radius change (déjà couvert au point 1).

**Audit "custom vs kit" demandé en parallèle** : recherche exhaustive dans `apps/web/src/features/**` (select natifs, modals/dropdowns/tooltips faits main, checkbox/switch natifs, tabs faites main, badges faits main, spinners faits main) — **rien trouvé**. Tout le code métier utilise déjà correctement les composants de `components/ui/`, y compris les vues complexes comme le Gantt de planning (`planning-timeline.tsx`). Aucune correction nécessaire de ce côté.

**Fichiers concernés (ajout au point "Fichiers touchés")** : `card.tsx`, `dialog.tsx`, `alert-dialog.tsx`, `dropdown-menu.tsx`, `popover.tsx`, `select.tsx` (uniquement les classes overlay/contenu — pas de changement de structure/props, pas de nouvelle dépendance).

### 8. États de chargement — constat et correctif
Constat (grep exhaustif sur `apps/web/src`) : **aucun indicateur de chargement nulle part** dans l'app.
- Aucune query de liste (`useTripsControllerList`, `useClientsControllerList`, `useDriversControllerList`, `useFleetVehiclesControllerList`, planning) ne vérifie `isLoading`/`isFetching` — au premier chargement (ou un refetch lent), le tableau/la liste est juste vide, sans rien qui l'indique.
- `apps/web/src/components/ui/skeleton.tsx` (le skeleton shadcn standard) existe mais **n'est utilisé nulle part** — scaffoldé puis jamais branché.
- Les mutations désactivent bien leur bouton via `disabled={mutation.isPending}` (~19 call sites : `client-create-dialog.tsx`, `vehicle-edit-dialog.tsx`, `driver-create-dialog.tsx`, `unlink-vehicle-dialog.tsx`, `booking-creation-bar.tsx`, `booking-cancel-dialog.tsx`, `driver-unavailability-dialog.tsx`, `advance-step-confirm-dialog.tsx`, `vehicle-create-dialog.tsx`, `dispatch-confirm-dialog.tsx`, `client-edit-dialog.tsx`, `vehicle-unavailability-dialog.tsx`, `link-vehicle-to-partner-dialog.tsx`, `booking-edit-dialog.tsx`, `driver-edit-dialog.tsx`, `event-creation-bar.tsx`, `nameboard-upload-dialog.tsx`, `event-client-create-dialog.tsx`), mais sans spinner ni changement de texte — juste `opacity-50`, facile à louper. Seule exception : `login-page.tsx` change le texte (`"Signing in…"`/`"Verifying…"`).
- Le `Toaster` (`components/ui/sonner.tsx`) a une icône de chargement préconfigurée (`Loader2Icon`) pour le pattern `toast.loading`/`toast.promise`, mais rien ne l'utilise — seulement `toast.success`/`toast.error` après coup.

Correctif, réutilisant l'existant/le kit officiel plutôt que du code maison :
- **Listes** : brancher `Skeleton` (déjà écrit, jamais utilisé) sur `query.isLoading` (le "premier chargement sans cache", pas `isFetching` — sur Bookings notamment, `useTripEvents()` déclenche des refetch SSE fréquents en arrière-plan ; les gater sur `isFetching` ferait clignoter la liste à chaque évènement). Un skeleton par table/liste concernée (`bookings-table.tsx`, `clients-page.tsx`, `drivers-page.tsx`, `vehicles-page.tsx`), au même endroit que le rendu vide/actuel.
- **Boutons de mutation** — **correction : shadcn a un composant `Spinner` officiel** (`components/ui/spinner.tsx`, `pnpm dlx shadcn@latest add spinner`, un fin wrapper autour de `LoaderIcon` de lucide-react + `animate-spin`) — on installe et utilise `<Spinner />` (au lieu d'un `<Loader2Icon className="animate-spin" />` fait main) avant le texte à chaque call site listé ci-dessus. Le composant `Button` gère déjà la taille d'icône automatiquement.
- **Login** (`login-page.tsx`) : garder le changement de texte existant, y ajouter le même `<Spinner />` pour rester cohérent avec les autres boutons.

Hors scope explicite : `toast.loading`/`toast.promise` (mise à jour dynamique d'un toast pendant une mutation) — l'ajout des spinners de bouton couvre le besoin immédiat ("on ne sait pas que ça charge"), le pattern toast.promise est une amélioration future si voulu, pas nécessaire pour clore ce chantier.

### 9. Login — mot de passe masqué avec œil, et vrai composant OTP
Constat (`apps/web/src/features/auth/login-page.tsx`) : le champ password est un `<Input type="password">` nu, sans bouton pour afficher/masquer ; le champ code (`code`) est un `<Input inputMode="numeric" maxLength={6}>` nu, pas de rendu "6 cases" habituel d'un OTP.

Vérifié sur le registre shadcn officiel (pas de code inventé) :
- **Pas de composant "Password" dédié** dans le catalogue shadcn, mais un composant **`InputGroup`** officiel (`pnpm dlx shadcn@latest add input-group`) est fait pour exactement ce cas — sa doc a un exemple documenté avec `EyeOffIcon` en `align="inline-end"`. Implémentation : `InputGroup` + `InputGroupInput type={visible ? 'text' : 'password'}` + `InputGroupAddon align="inline-end"` contenant un `InputGroupButton` togglant un état local `visible` avec `EyeIcon`/`EyeOffIcon` (lucide-react, déjà en dépendance).
- **OTP : composant officiel `InputOTP`** (`pnpm dlx shadcn@latest add input-otp`, construit sur la lib `input-otp`) — remplace le `<Input maxLength={6}>` par `InputOTP maxLength={6}` + `InputOTPGroup` + `InputOTPSlot` (6 cases), toujours branché sur le même `FormField`/`react-hook-form` (l'API `value`/`onChange` de `InputOTP` est compatible `Controller`).

Nouvelle dépendance : `input-otp` (npm package, requis par `InputOTP` — normalement ajouté automatiquement par la commande `shadcn add`, sinon `apps/web/package.json` à la main).

## Fichiers touchés

- `apps/web/package.json` — deps `@fontsource-variable/inter`, `tw-animate-css` (dev), `input-otp`
- `apps/web/src/main.tsx` — import police
- `apps/web/src/index.css` — `--radius`, tokens accent, `font-family` body, `@import "tw-animate-css"`
- `apps/web/src/components/layout/app-shell.tsx` — icônes nav
- `apps/web/src/components/ui/input-group.tsx`, `input-otp.tsx`, `spinner.tsx` (nouveaux, générés via `pnpm dlx shadcn@latest add input-group input-otp spinner` — composants officiels, pas de code maison)
- `apps/web/src/components/search-combobox.tsx` — icône (si absente)
- `apps/web/src/features/auth/login-page.tsx` — password en `InputGroup` + œil, code en `InputOTP`
- `apps/web/src/components/ui/card.tsx` — `border` → `ring-1 ring-foreground/10`, retrait de `shadow-sm`
- `apps/web/src/features/bookings/trip-status.ts` + `status-badge.tsx` — icônes + badge pill-outline tokenisé
- `apps/web/src/features/bookings/status-badge.test.tsx` — réécriture des 7 assertions emoji
- `apps/web/src/features/bookings/trip-form-fields.tsx` — icônes sur Pickup address / Pickup time
- `booking-creation-bar.tsx` — icône avant texte (Create / Create & Dispatch)
- `bookings-table.tsx` — vérifier le contenu actuel des boutons Edit/Cancel avant d'ajouter une icône
- `dialog.tsx`, `alert-dialog.tsx`, `dropdown-menu.tsx`, `popover.tsx`, `select.tsx` — overlay flouté + `ring` au lieu de `border`
- `bookings-table.tsx`, `clients-page.tsx`, `drivers-page.tsx`, `vehicles-page.tsx` — branchement de `Skeleton` sur `query.isLoading`
- Les ~19 call sites de boutons de mutation listés au point 8 (+ `login-page.tsx`) — spinner `Loader2Icon` sur `isPending`

## Vérification

1. `cd apps/web && pnpm install`
2. `pnpm dev`, ouvrir Bookings, le dropdown utilisateur du header, un select du formulaire trip, une dialog d'édition
3. Vérifier : Inter appliqué, radius adouci mais pas en pilule, accent plus vif, icônes nav/boutons/badges/champs, badges pill-outline colorés, transitions fade+zoom sur dropdown/select/popover/dialog, overlay flouté sur les dialogs, cards/contenus de dialog/dropdown/popover en `ring` (pas de bordure dure), boutons/inputs/select-trigger toujours en bordure classique
4. Vérifier les états de chargement : couper le réseau/throttle pour voir le skeleton sur Bookings/Clients/Drivers/Vehicles au premier chargement, et le spinner sur un bouton de mutation (ex. créer un client) le temps de la requête
5. Vérifier le login : bouton œil qui bascule le type du champ password, code à 6 chiffres en cases séparées (`InputOTP`), le tout toujours validé par le même schéma Zod/react-hook-form
6. `pnpm test` (inclut `status-badge.test.tsx` réécrit) et `pnpm build`

---

## Journal

> **2026-08-27 — Cadrage initial.** Constat : kit shadcn fonctionnel mais terne (pas de police custom, accent délavé, radius plat). Comparaison "existant vs proposition" inspirée du preset shadcn Rhea (mesuré en live : Inter, boutons quasi-pilule, cards à 24px de radius).

> **2026-08-27 — Correction radius.** Le radius "pilule" plein sur boutons/inputs jugé excessif → arrondi modéré (~10-12px) retenu, un seul token à changer (`--radius`) grâce au système `@theme inline` existant qui dérive `sm/md/lg/xl` de la racine.

> **2026-08-27 — Extension du scope.** Ajout d'icônes (lucide-react, déjà en dépendance) en nav/boutons/badges/champs, refonte des badges de statut en pill-outline, et activation des animations Radix déjà présentes dans le markup mais inertes (ajout `tw-animate-css`, confirmé compatible avec le setup Tailwind v4 + `@tailwindcss/vite` du projet via lecture de `vite.config.ts`).

> **2026-08-27 — Analyse de faisabilité (avant implémentation).** Deux corrections au plan suite à l'analyse du code réel :
> - Le champ "Customer" du formulaire trip n'est **pas** un `Input` mais un `SearchCombobox` — l'icône doit être ajoutée à ce composant, pas à `Input`. Seuls Pickup address / Pickup time sont de vrais `Input`.
> - `Input` est utilisé nu (sans wrapper) dans ~25+ endroits via `FormControl`/`Slot.Root`, qui exige un enfant unique ref-forwardant — un wrapper `<div>` dans `input.tsx` casserait tout. Solution : composant séparé `InputWithIcon`, `input.tsx` non touché.
> - `status-badge.test.tsx` contient 7 assertions texte sur les emoji actuels (`getByText('📤 Send ?')` etc.) — à réécrire en même temps que le remplacement par des icônes, sans quoi la suite de tests casse silencieusement.

> **2026-08-27 — Ajout overlay flouté + surfaces "base".** L'utilisateur aime le style des composants "base" de shadcn (`ui.shadcn.com/docs/components/base/alert-dialog`) : overlay flouté au lieu d'un simple assombrissement, contenu en `ring` léger plutôt qu'en bordure classique. Mesuré en direct sur le site (`bg-black/10 supports-backdrop-filter:backdrop-blur-xs`, `ring-1 ring-foreground/10`) et adapté (overlay un peu plus contrasté que la référence pour rester lisible sur les écrans de dispatch). Changement d'une ligne de classe par fichier sur `dialog.tsx`, `alert-dialog.tsx`, `dropdown-menu.tsx`, `popover.tsx`, `select.tsx` — pas de changement de structure.

> **2026-08-27 — Ajout des états de chargement, même chantier.** L'utilisateur a remarqué l'absence totale de spinner dans l'app. Grep exhaustif confirmant : aucune query de liste ne vérifie `isLoading`, le composant `Skeleton` existe mais n'est jamais utilisé, les ~19 boutons de mutation se contentent de `disabled` sans retour visuel, le `Toaster` a une icône de chargement prête mais aucun `toast.loading` n'est déclenché nulle part. Décision : corriger dans le même chantier plutôt qu'en suivi séparé, en réutilisant l'existant (`Skeleton`, `Loader2Icon` de `lucide-react` déjà en dépendance) — pas de nouvelle lib, pas de nouveau composant. `toast.loading`/`toast.promise` explicitement laissé hors scope (amélioration future, pas nécessaire pour combler le manque signalé).

> **2026-08-27 — Vérification systématique du style shadcn "base" par composant.** L'utilisateur a demandé de vérifier `ui.shadcn.com/docs/components/base/xxx` pour chaque composant du kit, pas seulement les dialogs, et de vérifier en parallèle qu'aucun composant métier ne réinvente à la main quelque chose qui existe déjà dans `components/ui/`. Deux résultats :
> - **Question architecturale résolue** : les pages `base/*` de shadcn utilisent les primitives **Base UI** (`@base-ui-components/react`), différentes du package `radix-ui` déjà utilisé dans ce repo. Comparaison directe `base/select` vs `radix/select` (mesures `getComputedStyle`) : le langage visuel est identique dans les deux variantes, seule la lib headless change. On peut donc prendre le look "base" en pur CSS/Tailwind sans migrer nos composants Radix vers Base UI — zéro nouvelle dépendance, zéro risque de régression comportementale. Mesures faites sur Card, Button, Select, Badge, Alert Dialog : le `ring` remplace la bordure sur les surfaces/conteneurs (Card, contenu de Dialog/AlertDialog/DropdownMenu/Popover/Select-ouvert), mais les contrôles interactifs (Button, Input, Select-trigger) gardent une bordure classique — distinction ajoutée au point 7.
> - **Audit "custom vs kit"** : recherche exhaustive dans `apps/web/src/features/**` (selects natifs, modals/dropdowns/tooltips faits main, checkbox/switch natifs, tabs et badges faits main, spinners faits main) — rien trouvé, tout le code métier utilise déjà correctement `components/ui/`, y compris le Gantt de planning. Aucune correction nécessaire de ce côté.

> **2026-08-27 — Login : password masqué + vrai OTP.** L'utilisateur a remarqué que le champ password du login n'a pas de bouton œil, et que le champ code (OTP, même simulé) n'a pas l'aspect "cases séparées" habituel. Vérifié sur le registre shadcn officiel : pas de composant "Password" dédié, mais `InputGroup` (avec un exemple documenté `EyeOffIcon` en `align="inline-end"`) est fait pour ça ; `InputOTP` existe bien comme composant officiel (basé sur la lib `input-otp`). Décision : installer ces deux composants officiels plutôt que d'écrire du code maison — et au passage, `InputGroup` remplace le composant custom `InputWithIcon` prévu au point 4 pour les icônes de champs (Pickup address/time), et le composant officiel `Spinner` (découvert au même moment) remplace le `Loader2Icon` fait main prévu au point 8. Cohérent avec la consigne de l'utilisateur : utiliser le kit plutôt que réinventer quand un composant existe déjà.

> **2026-08-28 — Implémentation du plan (points 1 à 9).** Tout le plan est en place, vérifié par `tsc -b`, `pnpm test` (267 tests, 29 fichiers), `pnpm build`, `oxlint` (0 erreur) et `playwright test` (25/25), plus une passe manuelle en navigateur (Bookings/Clients/Planning/Settings + login) : Inter chargée, `--radius: 0.75rem` (boutons à 10px), accent `oklch(0.48 0.13 165)`, `enter`/`exit` de `tw-animate-css` actives sur les surfaces Radix, `ring-1 ring-foreground/10` sans bordure sur card/dialog/dropdown/popover/select, overlay `bg-black/40 backdrop-blur-sm`, badges pill-outline avec icône, œil sur le password, OTP en 6 cases. Écarts et précisions par rapport au plan écrit :
> - **Installation des composants shadcn** : `pnpm dlx shadcn add` échoue dans cet environnement (`ERR_PNPM_UNEXPECTED_STORE` — le store pnpm a bougé de `snap/code/252` à `259` alors que `node_modules` est lié à l'ancien). Contournement : `pnpm --store-dir <ancien store> add …` pour les dépendances, et les 3 composants (`spinner`, `input-group`, `input-otp`) récupérés depuis le registre officiel (`ui.shadcn.com/r/styles/new-york-v4/*.json`) avec le seul remplacement des imports `@/registry/new-york-v4/ui/*` → `@/components/ui/*`. Code strictement identique à ce qu'aurait écrit la CLI, aucun composant maison.
> - **Icônes de nav sur les 9 liens, pas 5.** Le plan n'en nommait que 5 (Bookings/Clients/Drivers/Vehicles/Planning) mais la nav en compte 9 — laisser Events/Invoicing/Finance/Settings sans icône aurait eu l'air d'un oubli. Ajout de `PartyPopper`/`ReceiptText`/`Banknote`/`Settings` dans le même esprit, et la liste des liens sortie du JSX en constante `NAV_ITEMS`.
> - **`SearchCombobox`** : la vérification prévue au point 4 confirme que cmdk fournit déjà une icône de recherche (`CommandInput` → `SearchIcon`), mais dans le panneau ouvert seulement — le trigger fermé, celui qu'on voit dans le formulaire, n'en avait pas. Ajout d'une prop optionnelle `icon?: LucideIcon` rendue en tête du trigger, utilisée pour Customer (`User`). Aucun autre call site changé.
> - **Adresses PU *et* DO** en `InputGroup`+`MapPin` : les deux passent par le même composant `LocationField`, les séparer aurait demandé une prop uniquement pour dé-styler le champ DO. Le bouton 📍 de géocodage à côté reste tel quel (emoji hors scope, cf. point 5).
> - **Token `--warning` assombri** (`oklch(0.75 0.16 80)` → `oklch(0.62 0.15 70)`) : il n'était consommé nulle part dans l'app, et à L=0.75 il est illisible en texte. Son unique consommateur est désormais le statut ENROUTE du badge — d'où l'ajustement, à contraste correct sur fond clair. Aucun autre rendu impacté.
> - **Badge : les deux rendus du legacy sont conservés.** Le point 5 ne demandait de remplacer que « le badge plein solide » ; `isStatusHighlighted`/`HIGHLIGHTED_STEPS` (mirroir du legacy) restent, avec pill-outline tokenisé pour les steps highlighted et texte coloré + icône pour les autres — ce que confirme d'ailleurs la table d'icônes du plan, qui couvre aussi ENROUTE/ARRIVED/ONBOARD. Icônes lucide prises sous leur nom courant (`CircleCheck`/`CircleX`) plutôt que les alias dépréciés `CheckCircle2`/`XCircle` : mêmes glyphes.
> - **Skeletons : un composant partagé** `components/table-skeleton-rows.tsx` (`<TableSkeletonRows columns={n} />`) plutôt que 4 blocs de lignes dupliqués, branché via une prop `loading` sur `BookingsTable`/`ClientsTable`/`DriversTable`/`VehiclesTable` et alimenté par `query.isLoading` depuis les pages. Vérifié en direct sous throttling réseau (70 puis 125 skeletons rendus au premier chargement de Drivers/Vehicles, aucun sur un retour en cache).
> - **Spinners : 5 des ~19 call sites passent par `ConfirmActionDialog`** (`unlink-vehicle`, `users-tab`, `invoice-create`, `advance-step-confirm`, `dispatch-confirm`) — le `<Spinner />` y est ajouté une fois dans le composant partagé plutôt qu'à chaque appelant. Les 14 autres + login sont patchés individuellement.
> - **Les tests e2e cassaient aussi**, pas seulement `status-badge.test.tsx` que le plan avait repéré : `booking-lifecycle.spec.ts` (2 assertions) et `farm-out-subcontractor.spec.ts` (4) matchaient les libellés emoji. Réécrites en `getByText('…', { exact: true })` sur le texte nu.
> - **Bug pré-existant corrigé au passage** : aucun. `sonner.tsx` importe `Loader2Icon` de lucide-react v1 — vérification faite, l'alias existe toujours dans le barrel (`LoaderCircle as Loader2Icon`), rien à changer.

> **2026-08-28 — Deuxième passe : bords noirs, cadres de tableaux, menu.** Retour utilisateur après la première passe : « les tableaux ont des bords noirs comme les dropdown avec un search », « tout doit être iso, ça doit ressembler à des cards pour les bords », « des dividers entre les items du menu et un petit effet au hover », « le head du tableau, un léger gris pour différencier », « rapproche-toi au maximum des liens shadcn base ». Traité ainsi :
> - **Cause racine des bords noirs (bug pré-existant, pas une régression de la première passe)** : `apps/web/src/index.css` n'avait pas le `@layer base { * { @apply border-border outline-ring/50 } }` que shadcn pose systématiquement en Tailwind v4. Or v4 résout un `border`/`border-b` nu en **`currentColor`**, pas en gris : tout le kit peignait ses bordures en `--foreground` (`oklch(0.18 0.02 240)`, quasi noir) — cadres et filets de tableaux, barre de recherche des combobox, onglets, cadre du Gantt. Mesuré en direct (`getComputedStyle` → `oklch(0.18 0.02 240)` là où la démo shadcn donne `lab(90.95 …)`). Le layer ajouté corrige l'ensemble d'un coup, et rend enfin `--border`/`--ring` réellement utilisés.
> - **Cadres de tableaux → look card.** Les 9 sites écrivaient à la main `<div className="overflow-x-auto rounded-md border">`. Remplacés par un composant partagé `components/table-card.tsx` (`overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10`) — même langage que `<Card>`. Le scroll horizontal reste assuré par le conteneur interne de `<Table>` (vérifié : `scrollWidth > clientWidth` scrolle toujours dans un cadre étroit). Réponse à « il doit y avoir des composants pour les tableaux non ? » : oui, `components/ui/table.tsx` (Table/TableHeader/TableRow/TableCell shadcn) était déjà utilisé partout ; seul le cadre extérieur était fait main.
> - **Head de tableau en léger gris** : `bg-muted/50` sur `TableHeader` dans `table.tsx` (global, donc les 9 tableaux d'un coup) — le `overflow-hidden` du `TableCard` fait suivre la teinte aux angles arrondis.
> - **Menu** : la nav passe de `gap-3` + simple changement de couleur à des `<Separator orientation="vertical">` entre chaque lien et un vrai état hover (`rounded-md px-2 py-1.5 hover:bg-accent hover:text-accent-foreground`), le lien actif en `bg-accent/60`. Piège : `Separator` porte `data-[orientation=vertical]:h-full`, plus spécifique qu'un `h-4` passé en `className` — dans une nav sans hauteur fixe ça donne `height: 0`. D'où `data-[orientation=vertical]:h-4` au call site.
> - **Alignement « base » poussé plus loin**, mesuré composant par composant sur `ui.shadcn.com/docs/components/base/{table,dropdown-menu,select,combobox}` : surfaces flottantes en `rounded-lg` + `duration-100` (dropdown, select, popover, command) ; items de menu en `rounded-md py-1 px-1.5 gap-1.5` (au lieu de `rounded-sm py-1.5 px-2 gap-2`) ; et surtout la **barre de recherche des combobox** qui, chez shadcn base, n'est pas un filet `border-b` pleine largeur mais un champ encastré (`m-1 mb-0 h-8 rounded-md border-input/30 bg-input/30`) — repris tel quel dans `CommandInput`. Les hauteurs de contrôles (32px chez base vs 36px ici) n'ont **pas** été touchées : hors demande, et ça déplacerait toute la densité des formulaires.
> - **Bug pré-existant corrigé au passage — le Gantt du Planning.** Repéré en vérifiant que le `ring` du cadre ne cassait rien : les paires libellé/lane de `planning-timeline.tsx` étaient toutes empilées en colonne 1, une par ligne, la timeline entière décalée. Vérifié via `git stash` que c'était **antérieur** à ce chantier. Cause : l'overlay « Now » est placé explicitement (`col-start-2`, `gridRow: headerRows+1 / span rows.length`) ; en CSS Grid les items à position définie sont posés **avant** les autres, il réservait donc la colonne 2 de chaque ligne de données et l'auto-placement n'avait plus que la colonne 1. Correctif : placement explicite (`col-start-1`/`col-start-2` + `gridRow`) sur les cellules d'en-tête et de chaque ligne, ce qui laisse l'overlay se superposer aux lanes au lieu de leur disputer une cellule. Vérifié en 1 jour et en 3 jours (deux lignes d'en-tête).
> - **Vérifs** : `tsc -b`, `vitest` 267/267, `oxlint` 0 erreur, `vite build`, `playwright` 25/25, plus une passe navigateur sur Bookings/Clients/Vehicles/Planning (List + Timeline 1j/3j)/Settings et le combobox de recherche.

> **2026-08-28 — Troisième passe : plus aucun emoji, icônes sur les titres, respiration de la nav.** Retour utilisateur : « il y a encore plein d'icônes de ce type 📍, ⬇️… on avait pas dit qu'on passe par lucide ? », « j'ai des boutons dans bookings avec cette icône, pas sûr qu'ils servent à quelque chose », « mets plus de gap dans les liens du menu, quand ils sont sélectionnés la petite box est trop près des dividers », « pour tous les titres également mets les icônes du menu ». Le point 5 du plan avait explicitement mis ces emoji **hors scope** ; ce retour lève cette réserve, tout est traité maintenant.
> - **Zéro emoji rendu dans l'app** (vérifié par un grep sur les plages Unicode emoji dans `apps/web/src` : plus que le mot « 📍 » dans un commentaire d'explication). Convertis : les libellés du formulaire trip (`📅 Date`, `PU 🕐 (local)`, `📍 PU`/`📍 DO`, `📝 Info`, `✈️ Flight number`), les résultats de vérification de vol (`✅`/`⚠️`), les boutons Invoicing (`⬇️ Export to Excel`, `🧾 Invoice`), les colonnes « Event » et « Sub-C » (`✅`/`✓`), les icônes de ligne du Gantt (`🫥` → `CalendarOff`, `🔧` → `Wrench`, la même que la table Vehicles pour la même action) et les 7 étapes des pages publiques `/track` et `/driver` (`👍📍🧍🏁✈️📨🚗`).
> - **Un seul vocabulaire d'icônes par étape.** Les pages publiques affichaient les mêmes étapes que le badge dispatcher avec d'autres glyphes. Extrait dans `features/bookings/trip-step-icons.ts` (`STEP_ICONS`), consommé par `status-badge.tsx` et par `StepIcon` des pages publiques : une étape = une icône, partout.
> - **Les boutons 📍 de Bookings** (la question « ça sert à quelque chose ? ») : oui — ils géocodent l'adresse saisie pour remplir le code IATA et, côté pickup, le fuseau horaire du trip (`geoControllerGeocodeTz`). Rien ne le disait. Repliés **dans** le champ en `InputGroupAddon align="inline-end"` (le pattern shadcn base), avec `LocateFixed`, un `aria-label`/`title` explicite (« Detect airport code and timezone from this address ») et un `<Spinner />` pendant l'appel, au lieu d'un bouton emoji flottant à côté.
> - **Titres de page = icône du menu.** `NAV_ITEMS` sorti de `app-shell.tsx` vers `components/layout/nav-items.ts`, et un composant `components/layout/page-title.tsx` qui **résout l'icône depuis la route courante** plutôt que de la recevoir en prop — comme ça l'entrée de nav et le titre d'une section ne peuvent pas diverger. Appliqué aux 9 pages.
> - **Nav** : séparateurs passés de `mx-0.5` à `mx-2`, ce qui aère les liens et laisse 8px entre la pastille de l'onglet actif et le divider. La nav fait 962px dans un header de 1280px — pas de débordement.
> - **Vérifs** : `tsc -b`, `vitest` 267/267, `oxlint` 0 erreur, `vite build`, `playwright` 25/25, passe navigateur sur Bookings, Clients, Invoicing, Planning (Timeline), `/track/:ref` et `/driver/:ref`.
> - **Note d'environnement** : la suite Playwright a d'abord sorti 3 échecs (`drivers-lifecycle` ×2, `invoicing-lifecycle` ×1) sans rapport avec le code — `cockpit_test` avait accumulé 27 chauffeurs et 23 comptes au fil des exécutions répétées, au-delà de la pagination à 20, donc les lignes créées par les specs tombaient en page 2. C'est exactement la dérive annoncée dans le commentaire de `playwright.config.ts` (`test:e2e:prepare` reseede mais ne truncate pas). Base `cockpit_test` remise à plat (TRUNCATE + `test:e2e:prepare`) → 25/25. La base de dev `cockpit` n'est pas touchée (7 chauffeurs / 9 trips avant et après). À refaire si la suite se remet à échouer sur des lignes « invisibles » après plusieurs runs locaux.

## À décider

- **Hauteur des contrôles** : shadcn « base » est à 32px (boutons, select-trigger, input), le kit est à 36px. Non modifié — ça déplacerait la densité de tous les formulaires, hors de ce qui a été demandé. À trancher si on veut l'alignement complet.

> **2026-08-28 — Correctif API : recherche par tokens (suite du diagnostic e2e).** Le débogage des 3 échecs Playwright ci-dessus a mis au jour un bug produit, corrigé ici (changement **API uniquement**, aucun fichier `apps/web` touché) : `ClientsService.list()`, `DriversService.list()` et `FleetVehiclesService.list()` comparaient la chaîne de recherche entière à chaque colonne séparément. Comme le nom affiché est dérivé (`computeClientName` = prénom + nom, `computeDriverName`, « make model » pour un véhicule) et n'est stocké dans aucune colonne, toute recherche enjambant deux champs renvoyait zéro — alors que les placeholders promettent « Search by ref, **name**, email… ». Vérifié en SQL : `Marc Dubois` → 0, `Julien Petit` → 0, `Mercedes V-Class` → 0 (contre 2 attendus).
> - Nouveau `apps/api/src/common/utils/search-tokens.ts` : `searchTokensFilter(search, fields)` découpe la saisie sur les espaces et ET-e les tokens, chacun OR-é sur les colonnes. Une recherche à un seul mot (ref, email, plaque) produit exactement le filtre d'avant — aucune régression possible de ce côté.
> - Contrepartie assumée : un résultat peut enjamber deux champs sans rapport (`Uber James` remonte James Whitfield via `company` + `firstName`). Ça élargit, ça ne masque rien.
> - 14 surfaces UI en bénéficient d'un coup : les 3 barres de recherche de page (Clients/Drivers/Vehicles) et les 11 pickers (Customer, Driver, Partner, Reg Nbr, Event) des formulaires trip, des filtres Bookings, d'Invoicing et d'Events.
> - Effet de bord bienvenu : `invoicing-lifecycle.spec.ts` ne dépendait de la page 1 non filtrée que parce que la recherche serveur ne trouvait rien ; elle fonctionne maintenant vraiment.
> - **Vérifs** : `tsc` API OK, `eslint` API OK (a aussi corrigé un défaut de formatage prettier pré-existant sur la signature de `FleetVehiclesService.list`), `jest` 29/29 sur 6 suites — la 7e, `clients.service.spec.ts`, échoue à charger `@cockpit/shared` (`SyntaxError: Unexpected token 'export'`), **antérieur** à ce changement (l'import fautif est en ligne 9 dans `HEAD`, inchangé) et non traité ici. Vérification fonctionnelle en direct contre l'API sur `cockpit_test`, 10 cas : nom complet, ordre inversé, mot unique, raison sociale, ref, plaque, société+prénom, et un cas sans résultat (bien 0, la recherche ne s'élargit pas à tout).
> - **Non vérifié** : la suite Playwright web n'a pas été relancée — l'arbre `apps/web` contient au même moment le chantier « modal de création de booking » d'une autre session, et il ne compile pas (10 erreurs TS2741, prop `onNewBooking` manquante dans `drivers-table.test.tsx` / `vehicles-table.test.tsx`). À relancer une fois ce chantier stabilisé.

> **2026-08-28 — Correctif : la suite jest `clients.service.spec.ts` ne se chargeait pas.** Signalé à l'entrée précédente comme « antérieur, non traité » ; diagnostiqué et corrigé ici. Rien à voir avec `@cockpit/shared` en général : le fichier fautif est `packages/shared/src/validation/email.js`, du **JS ESM volontaire** (son en-tête l'explique : chargé brut par Vite, et Node a besoin d'un vrai `.js` au runtime de l'API, où `require(esm)` de Node 22+ s'en occupe), dans un dossier portant `{"type": "module"}`. Le runtime CommonJS de Jest n'a pas `require(esm)` → le fichier arrivait tel quel → `SyntaxError: Unexpected token 'export'`.
> - **Pourquoi ts-jest ne s'en sortait pas** (deux fausses pistes écartées par la mesure, pas par déduction) : (1) le pattern `packages/shared/.*\.(t|j)s$` couvre bien les `.js` et ts-jest est bien invoqué — vérifié en pointant le transform vers un module inexistant ; (2) `allowJs` activé (via un tsconfig dédié puis en inline) ne suffit pas — `TS_JEST_LOG` montre que le compilateur voit `email.js` avec `allowJs: true`, mais il redérive le format de module depuis le `{"type": "module"}` du dossier et ré-émet de l'ESM. Sa propre échappatoire (forcer `module: CommonJS` via `ts.transpileModule`, qui ne lit aucun `package.json`) n'est câblée que pour les fichiers sous `node_modules` — cf. la branche `isNodeModule` dans `ts-jest-transformer.js` ligne ~186. Le tsconfig dédié a été supprimé, il ne servait à rien.
> - **Correctif** : `apps/api/jest-esm-js-transformer.cjs`, ~20 lignes sur le `typescript` déjà présent (aucune dépendance ajoutée), branché en tête du `transform` des deux configs jest sur `packages/shared/.*\.js$` — l'ordre compte, les patterns suivants matchent aussi les `.js`.
> - **Piège** : la config unitaire tourne en CommonJS, mais `test/jest-e2e.json` tourne avec `--experimental-vm-modules`, où Jest charge ce fichier comme un vrai module ES. Une première version forçait CJS partout et cassait la suite e2e API dans l'autre sens (`ReferenceError: exports is not defined`, 13 suites). Le transformer suit donc `transformOptions.supportsStaticESM` : ESM laissé tel quel, CJS transpilé — et `getCacheKey` intègre ce mode, sinon le cache mélange les deux sorties.
> - **Résultat** : suite unitaire **6/7 → 7/7 suites, 29 → 32 tests** (les 3 tests de `computeClientName` étaient injoignables). Suite e2e API **13/13, 117/117** — vérifié non régressée : elle passait déjà avant (l'ESM brut fonctionne sous `--experimental-vm-modules`, confirmé en retirant temporairement le nouveau transform).
> - Ajouté `jest-esm-js-transformer.cjs` aux `ignores` d'eslint, à côté d'`eslint.config.mjs` déjà là pour la même raison (fichier de config hors projet tsconfig, illisible par les règles type-aware). `tsc` API OK, aucune erreur eslint dans les fichiers touchés (les 8 fichiers en erreur du dossier sont pré-existants, des DTO/contrôleurs non touchés — le script `lint` du projet tourne avec `--fix`).
> - Base `cockpit_test` reseedée après coup (la suite e2e API truncate via `resetDatabase`) : 2 comptes / 3 chauffeurs / 2 véhicules, l'état attendu par Playwright.
