# Handoff — Cockpit v2, verticale `/invoicing`

> Suite de `2026-08-27-frontend-events.md`. `/invoicing` était la dernière des 8 pages authentifiées listées dans `docs/FRONTEND_PLAN.md`, restait après elle : `/finance` (stub) et `/settings`, plus les deux pages publiques `/driver/:ref` et `/track/:ref`.

**Session du** : 2026-08-27

## Contexte

Recherche préalable (agent Explore + lecture intégrale de `invoicing.html`, 819 lignes) : le back (`apps/api/src/invoices/`) était **déjà quasi entièrement construit** — `GET /invoices`, `POST /invoices`, TVA configurable (`DEFAULT_VAT_RATE_PERCENT`), compteur de ref persistant (`RefCounterService`), transaction race-safe anti double-facturation, tout testé e2e (`apps/api/test/invoices.e2e-spec.ts`). Client API déjà généré. Cette session est donc presque entièrement de la **composition front**, sans aucun ajout backend.

Les 4 onglets du legacy : **Customer** (recherche + facturation) et **Partner log** (recherche + export, pas de facturation partenaire) sont pleinement fonctionnels dans le legacy ; **Driver log** et **History** sont des placeholders vides (`<div class="empty">Coming soon.</div>`) sans la moindre logique, même côté legacy.

### Décision de cadrage sur Driver log / History

L'utilisateur a explicitement demandé un cadrage avant de laisser quiconque (humain ou agent) construire ces deux onglets plus tard, en évoquant l'**Event Sourcing** comme piste. Après analyse — puis rétropédalage explicite de l'utilisateur ("un peu overkill et bourrer la bdd/vps pour rien") — le verdict documenté dans **`docs/agents/event-log-design.md`** (nouveau) est : **ni Event Sourcing complet, ni même un event-log léger ne sont nécessaires**. Les deux besoins décrits par les commentaires legacy sont satisfaisables avec les tables existantes :
- **History** ("immutable reports filed by client/period/ref-PO/event") ≈ `Invoice` existe déjà, immuable, avec tous les champs requis — il manque juste la pagination/les filtres sur `GET /invoices` (même schéma que `GET /clients`/`GET /drivers`).
- **Driver log** ("per-driver export with costs + total") ≈ un rapport d'agrégation de `Trip` par chauffeur/partenaire, structurellement identique au Partner log déjà construit cette session, plus une ligne de total.

Ce doc est référencé depuis les commentaires de tête de `driver-log-tab.tsx` et `history-tab.tsx` — à lire avant de sortir ces deux tabs du statut placeholder.

## Ce qui a changé

### Aucun changement backend

Tout l'existant (`apps/api/src/invoices/`) a été réutilisé tel quel.

### Front — nouveau dossier `apps/web/src/features/invoicing/`

- `customer-filters.ts`/`.test.ts` — `CustomerFilters` (toggle Client/Event mutuellement exclusif, dates, ref/PO, passager), `computeCustomerDefaultPeriod()` (port fidèle de la règle legacy : Date out = fin du mois précédent, Date in = 1er de ce mois sauf backlog non facturé plus ancien), `applyPendingFilters`/`applyInvoiceFilters` (le second par **chevauchement de période**, pas containment strict).
- `customer-filters-bar.tsx` — barre de recherche Customer.
- `pending-trips-table.tsx` — tableau dédié facturation (Date/Booking ref/Cust-Pax/Itinerary/Vehicle/Ref-PO/Event/Status/Amount/Action), **pas** une réutilisation de `BookingsTable` (colonnes différentes, fidèle à `renderPendingTable` du legacy).
- `invoiced-table.tsx` — une ligne par facture (pas par trip), actions PDF/Excel/Send/Correct.
- `invoice-create-dialog.tsx` — confirmation "Are you sure you want to invoice these rides?" → `POST /invoices`.
- `invoice-calc.ts`/`.test.ts` — `invoiceLineRows()` : Net/VAT/Gross par ligne, TVA prise sur le `vatRate` **propre à la facture** (pas un 10% en dur côté front comme le legacy — le back l'avait déjà généralisé). Le "Category" (type de véhicule) est résolu via un lookup `vehicleTypeNameById` fourni par l'appelant : `InvoiceEntity.trips[].trip` est un `TripBaseEntity` allégé (pas de relation `vehicleType` jointe), donc le nom vient de `GET /meta` plutôt que du trip lui-même.
- `invoice-pdf.ts` — génération PDF via `jspdf`+`jspdf-autotable` (nouvelles dépendances), **importées dynamiquement** (`import('jspdf')`) plutôt qu'en top-level : `pnpm build` alertait sur un chunk principal >1.5MB, `jspdf`+`jspdf-autotable`+`xlsx` (et leur dépendance partagée `html2canvas`/`purify`) n'étant nécessaires qu'au clic sur un bouton de téléchargement, pas au chargement de la page — chunk principal ramené à ~880KB, le reste dans des chunks séparés chargés à la demande. Note technique : `jspdf-autotable@5` attache `doc.lastAutoTable` à l'exécution mais ne le type pas sur la classe `jsPDF` — cast local (`InstanceType<typeof jsPDF>`) documenté dans le fichier.
- `invoice-excel.ts`/`.test.ts` — exports Excel via `xlsx` (nouvelle dépendance, même import dynamique que ci-dessus) : `tripsExcelRows`/`partnerTripsExcelRows`/`invoicesExcelRows` (fonctions pures, uniformes, `json_to_sheet`, testées sans toucher à l'import dynamique) et `downloadInvoiceDetailExcel` (bloc en-tête + détail + totaux, `aoa_to_sheet` car non uniforme).
- `invoice-send.ts`/`.test.ts` — construit l'URL `mailto:` (pas d'envoi réel, fidèle au legacy).
- `partner-filters.ts`/`.test.ts`, `partner-filters-bar.tsx`, `partner-log-tab.tsx` — même mécanique que Customer scopée sur `trip.partner`, réutilise `BookingsTable` (variant `farmout`) + les 5 dialogs Bookings (même précédent de réutilisation cross-feature qu'Events/Planning).
- `driver-log-tab.tsx`, `history-tab.tsx` — placeholders "Coming soon.", renvoient vers `docs/agents/event-log-design.md`.
- `invoicing-page.tsx` — composition en `Tabs` (shadcn), les 4 onglets legacy.
- `test-fixtures.ts` — `baseInvoice()`.
- `router.tsx`/`app-shell.tsx` — route + entrée nav `/invoicing`, après Events.

### Modifications ciblées à des fichiers partagés

- `apps/web/src/components/search-combobox.tsx` — nouvelle prop `aria-label`. Nécessaire car un `role="combobox"` calcule son nom accessible depuis un label associé, **pas** depuis le texte affiché dans le bouton — sans ça, les comboboxes de barre de filtre (Client/Event/Partner) n'avaient aucun nom accessible malgré un contenu visuel correct (bug découvert en écrivant le test Playwright, corrigé immédiatement — cf. la règle du projet sur les bugs trouvés).
- `apps/web/src/features/bookings/trip-status.ts` — `pickupLocalInstant()` élargi de `TripEntity` à `Pick<TripEntity, 'pickupAt' | 'timezone'>`, pour qu'il fonctionne aussi sur le `TripBaseEntity` allégé imbriqué dans `InvoiceEntity`.
- `pnpm-workspace.yaml` — `allowBuilds.core-js` fixé à `false` (placeholder généré automatiquement par la politique supply-chain de pnpm, bloquait toute commande `pnpm` tant qu'il n'était pas résolu ; `core-js` n'a besoin d'aucun script de build, son postinstall n'est qu'un message).

## Tests

- **Frontend unit** : `customer-filters.test.ts` (défaut de période, filtres Pending/Invoiced), `partner-filters.test.ts`, `invoice-calc.test.ts` (Net/VAT/Gross, résolution Category), `invoice-excel.test.ts` (row-shaping pur, pas l'écriture xlsx elle-même), `invoice-send.test.ts` (URL mailto).
- **Playwright** : nouveau `invoicing-lifecycle.spec.ts` — crée un client dédié (scopé par `Date.now()`, pour ne jamais être pollué par les runs précédents non tronqués), une course avec prix, facture-la depuis `/invoicing`, vérifie le calcul TTC/HT (100€ net → 110€ TTC à 10%), télécharge PDF/Excel (capturés via `page.waitForEvent('download')`, nom de fichier vérifié), Send (pas de navigation réelle), Correct (toast stub), export Excel du panneau Invoiced, puis smoke-test Partner log/Driver log/History.

## Résultats finaux

- `pnpm --filter @cockpit/api test` → **27/27**
- `pnpm --filter @cockpit/api test:e2e` → **113/113** (inchangé, aucun test backend ajouté)
- `pnpm --filter @cockpit/api exec tsc --noEmit` → propre
- `pnpm --filter @cockpit/web test` → **234/234** (+20 vs session précédente)
- `pnpm --filter @cockpit/web exec tsc --noEmit -p tsconfig.app.json` → propre
- `pnpm --filter @cockpit/web lint` → 8 warnings, tous préexistants (même baseline que la session Events)
- `pnpm --filter @cockpit/web exec playwright test` → **21/21** (+1)
- Vérification manuelle au navigateur (chrome-devtools MCP) sur `/invoicing` : recherche Customer, sélection client, création de facture (INV1, 88.00€ TTC / 80.00€ HT sur un prix de 80€), téléchargement PDF/Excel/Send/Correct sans erreur console, export Excel Pending/Invoiced, Partner log/Driver log/History. Aucune erreur console (hors avertissement `HydrateFallback` préexistant, sans rapport).

## Environnement pour reprendre

`docker compose` (dev, 5173/3000) up. **Rebuild nécessaire après l'ajout de `jspdf`/`jspdf-autotable`/`xlsx`** (déjà fait cette session, `docker compose up --build web`) — rappel : `node_modules` n'est jamais bind-monté dans les conteneurs dev (choix documenté dans `docker-compose.override.yml`, pour éviter un mélange de binaires natifs hôte/conteneur sur `argon2`/Prisma), donc tout changement de `package.json` (front ou back) exige ce rebuild.

Données laissées dans la base dev (non nettoyées, cohérent avec les sessions précédentes) : facture `INV1` créée manuellement sur le client `CI1` (Marc Dubois) pendant la vérification navigateur.

**Prochaine étape suggérée** : au choix entre `/finance` (stub), `/settings` (infos société + gestion utilisateurs), ou les deux pages publiques `/driver/:ref`/`/track/:ref` — voir `docs/FRONTEND_PLAN.md`.
