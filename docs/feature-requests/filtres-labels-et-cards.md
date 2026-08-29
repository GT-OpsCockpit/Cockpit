# Libellés de filtres + carte de filtres sur toutes les pages

## Problem

Sur les 8 pages à liste de Cockpit v2, les filtres sont une rangée de champs nue
posée entre le titre de la page et le tableau. Deux conséquences :

- **Rien ne nomme un champ.** L'information vit dans un `placeholder`, qui
  disparaît dès la première frappe — ou n'existe pas du tout. Une fois « Marc
  Dubois » choisi, plus rien à l'écran ne dit que ce champ filtre par client.
- **Trois `<Select>` n'ont aucun nom accessible** : Bookings/Période,
  Clients/Type, Planning/Période. `e2e/trip-edit-rbac.spec.ts` documentait
  explicitement ce trou et le contournait en ciblant le texte affiché
  (« Upcoming »).

S'y ajoute un problème de composition : la rangée de filtres flotte sur le fond
de page alors que les résultats qu'elle produit vivent dans une `TableCard`. Rien
ne relie visuellement la commande à son effet.

## Decision

- Chaque contrôle de filtre porte un **libellé visible**, associé par un vrai
  `<label for>` — donc un nom accessible, et donc une cible fiable pour les
  tests.
- Le bloc entier est posé dans une **carte** au même langage visuel que
  `TableCard` (`rounded-xl` + `ring-1`), pour que filtres et tableau se lisent
  comme un seul système.

Décisions prises avec Romain (étapes 1–4 de la skill `feature-request`) :

| Question | Décision |
|---|---|
| Style de carte | Cadre léger, même langage visuel que `TableCard` (`rounded-xl` + `ring-1`), padding serré — pas la `<Card>` shadcn pleine |
| Bouton « Reset filters » | En haut à droite de la carte, identique sur les 8 pages |
| Onglets (Planning) | **Pas** de libellé — un onglet affiche déjà ses options |
| Page Events | Une **seule carte fusionnée** : sélection d'événement + filtres |

Maquette validée (étape 2) : <https://claude.ai/code/artifact/2dbce412-83e4-4776-b0d4-1d1f447af6fb>
— avant/après sur Bookings, Planning et Events, plus le cas des cases à cocher.

## Scope

**In :**

- Nouveaux composants partagés `src/components/filter-card.tsx` et
  `src/components/filter-field.tsx`.
- `filter-reset-button.tsx` : retrait du `ml-auto` par défaut (porteur dans un
  `flex`, faux dans un en-tête `justify-between`).
- Les 8 barres : `booking-`, `client-`, `driver-`, `vehicle-`, `event-`,
  `customer-`, `partner-`, `planning-filters-bar.tsx`. Elles ne rendent plus que
  la grille de champs ; leurs props se réduisent à `{ filters, onChange }`
  (+ `resourceOptions` / `resourceLabel` pour Planning).
- Les 8 pages qui les rendent : elles enveloppent la barre dans `<FilterCard
  hasActiveFilters onReset>` — elles détenaient déjà ces deux valeurs
  (`filtersChanged()` + `resetFilters`) et les passaient en transit.
- `event-select-panel.tsx` : ne rend plus sa propre `<Card>`, seulement ses
  champs ; `EventsPage` compose la carte unique.
- Les specs Playwright cassées par les nouveaux noms accessibles (voir plus bas).

**Out :** Settings et Finance (aucun filtre). Aucune logique de filtrage, aucune
colonne, aucune donnée ne change. **Aucun `placeholder` existant n'est modifié**
— 29 appels `getByPlaceholder` en e2e en dépendent.

## Design

### `FilterCard`

Le cadre du bloc de filtres, calqué sur `table-card.tsx`. Il porte le titre
(« Filters » par défaut, « Event » / « Customer » / « Partner log » là où la page
avait déjà un intertitre) et le bouton reset, en haut à droite. Le bouton vit là
plutôt que dans chaque barre pour que sa position soit strictement identique sur
les 8 pages.

### `FilterField`

Le couple libellé + contrôle (`grid gap-1.5`, `Label` en `text-xs
text-muted-foreground`). Il reprend le motif déjà en place dans
`event-select-panel.tsx` : un `<label htmlFor>` sur un `SearchCombobox` — le
trigger est un `<button>`, donc un élément *labelable*, donc `getByLabel` le
résout.

Une case à cocher ne l'utilise pas (son libellé est à droite, pas au-dessus) :
`<div className="flex h-9 items-center gap-2">` suffit à l'aligner avec les
autres contrôles sous `items-end` — ce qui fait au passage disparaître le
bricolage `pb-2` de `customer-filters-bar.tsx`.

### Libellés retenus

Règle : **là où un `aria-label` existait, la chaîne est reprise mot pour mot** et
simplement rendue visible ; l'`aria-label` est retiré (sinon nom accessible en
double).

| Page | Libellés |
|---|---|
| Bookings | Search · Period · Customer · Driver · Passenger · **Vehicle type** · Service |
| Clients | Search · Type · *Show deactivated* (inchangé) |
| Drivers | Search · *Show deactivated* (inchangé) |
| Vehicles | Search · *Show deactivated* (inchangé) |
| Planning | Period · Driver/Vehicle (suit l'onglet) · Date — onglets non libellés |
| Events | **Customer** · Country · Date start · Date end · Vehicle type · Event name · Ref/PO |
| Invoicing / Customer | Client \| Event · Date in · Date out · Ref/PO · Passenger · *Events* |
| Invoicing / Partner | Partner · Date in · Date out · Ref/PO · Event |

Deux écarts volontaires par rapport au texte affiché aujourd'hui :

- **« Vehicle type »** et non « Vehicle » : plus juste, et le formulaire de
  création a déjà un champ « Vehicle ».
- Sur Events, le filtre client s'appelle **« Customer »** et non « Client » :
  la moitié haute de la même carte porte déjà un champ « Client » (celui du
  panneau de sélection), et deux champs homonymes côte à côte ne nomment rien.

Chaque contrôle reçoit un `id` stable (`bk-filter-period`, `cl-filter-type`, …)
pour l'association `htmlFor`.

### Events — carte fusionnée

```
FilterCard title="Event"
  ├─ EventSelectPanel   (Client · Event · Dates · Cancel/New/Confirm)
  ├─ <Separator />
  └─ EventFiltersBar    (les 7 champs de filtre)
```

Le `<h2>Search</h2>` de `events-page.tsx` disparaît, absorbé par la carte : il
n'avait pas de contenu propre au-delà de la rangée qui le suivait.

Le panneau passe aussi de `sm:grid-cols-4` à `sm:grid-cols-2 lg:grid-cols-4` :
en largeur tablette, un quart de la carte est plus étroit que Cancel/New/Confirm
côte à côte, et le dernier bouton débordait de la carte (constaté à 768 px lors
du passage navigateur).

### Planning

Les trois groupes d'onglets restent nus. Le commutateur Drivers/Vehicles reste
dans l'en-tête de page : c'est un choix de ressource, pas un filtre.

## Conséquences sur les tests

C'est le vrai coût du changement : donner un nom accessible à un filtre le rend
visible pour les requêtes Playwright *page-wide*, alors que la barre de filtres
reste dans le DOM derrière un dialogue ouvert. Toutes les casses ont cette forme.

Vérifié en rouge avant correction : `booking-lifecycle.spec.ts` échouait bien en
strict-mode sur `getByLabel('Customer')` → 2 éléments (le filtre + le champ du
dialogue).

1. `booking-lifecycle.spec.ts` — `selectSearchCombobox` et `selectFromDropdown`
   prennent un paramètre `scope: Locator` et reçoivent le `form` du dialogue,
   comme `events-lifecycle.spec.ts` le faisait déjà. Le popover reste `page`-scopé
   (portalé dans `<body>`).
2. `invoicing-lifecycle.spec.ts` — même chose : ce spec crée aussi une course
   depuis `/bookings`. Ses appels passent par `selectInDialog` (déjà présent) et
   par un `selectFromDropdown` scopé.
3. `events-lifecycle.spec.ts` — `selectFromDropdown` scopé au dialogue :
   `{ name: 'Vehicle' }` est un *substring*, donc « Vehicle type » y répondait.
4. `planning-lifecycle.spec.ts` — `page.locator('input[type="date"]')` devient
   `page.getByLabel('Date', { exact: true })`.
5. `trip-edit-rbac.spec.ts` — le contournement
   `getByRole('combobox').filter({ hasText: 'Upcoming' })` et son commentaire
   « pas de nom accessible » deviennent `getByRole('combobox', { name: 'Period' })`.
6. `client-lifecycle.spec.ts` — même contournement sur `'All types'` /
   `'Individual'` → l'aide `selectFromDropdown(page, 'Type', …)` du fichier.

Inchangés : les 29 `getByPlaceholder`, les `getByLabel('Show deactivated')`, et
les `getByLabel('Date in'/'Date out'/'Events')` d'Invoicing — chaînes conservées
à l'identique. Aucun test unitaire ne rend une `*-filters-bar.tsx`.

## Alternatives écartées

- **La `<Card>` shadcn pleine** (header + content + ombre) : trop lourde au-dessus
  d'un tableau qui, lui, n'a qu'un filet.
- **Une carte repliable** : le filtre est l'outil de travail de la page, le
  replier ajoute un clic à chaque visite.
- **Libeller les onglets** (« Vue : List / Timeline ») : un onglet montre déjà
  ses options.
- **Deux cartes distinctes sur Events** (sélection puis filtres) : elles
  répètent le même geste et empilent deux cadres pour une seule intention.
