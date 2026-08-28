# Handoff — cockpit-v2 : §14 de l'audit de parité est vide

**Date :** 2026-08-28 (3ᵉ passe, après l'audit et sa 2ᵉ passe du même jour)
**Point de départ :** `docs/handoff/2026-08-28-legacy-parity-audit.md` + le §14 de
`docs/LEGACY_PARITY_AUDIT.md`.

---

## 1. Ce qui a été fait

Les sept items encore ouverts en §14 ont été portés, dans cet ordre. Un commit par lot,
directement sur `main`.

| Commit | Lot | Item d'audit |
|---|---|---|
| `7c9cbd2` | Permissions sur les 4 `DELETE` définitifs | 1.3 |
| `381d35f` | Champ Area contraint aux villes du pays | 8.5 |
| `0171e47` | Réparation de 4 spécs Playwright pré-cassées | — |
| `1e30f62` | Rattachement à un événement : filtré et validé | 4.3 |
| `7f2d5a1` | `isBeforeArrival` sur le POC | 6.6.2 |
| `8704a3e` | `PATCH /assign` : notif POC + verrou sous-traitance | 6.6.1 |
| `408f5ff` | `offerEventReactivation` | 4.4 |
| `950c640` | Brouillons d'email de sous-traitance | 6.6.3 |

Les trois commits qui les précèdent (`a9b5166`, `ab7a2ca`, `16dc1c4`) sont la mise au propre de
l'arbre non commité trouvé au démarrage : backend + shared, front (refonte UI), docs.

**Le §14 ne liste plus rien d'ouvert.** Les seuls écarts qui subsistent dans l'audit sont deux
décisions assumées : la sémantique de devise (7.1, montants en EUR) et les popups d'édition rapide
(6.6.2, remplacées par le dialogue d'édition complet — leur seule règle métier, `isBeforeArrival`,
a été portée).

---

## 2. Décisions prises en cours de route, à connaître avant de rouvrir un sujet

1. **Une seule permission `record:delete`** pour les quatre `DELETE`, parce que le legacy avait une
   seule porte pour les quatre (`onPermanentDelete`, common.js:385-395). Aucune UI v2 ne les
   appelle encore : il n'y a donc pas de `usePermission()` à miroiter tant qu'aucun bouton
   « supprimer définitivement » n'existe.
2. **Le champ Area suggère, il ne ferme pas la liste.** Contraindre à un `<select>` aurait été une
   régression : le champ legacy acceptait n'importe quelle ville tapée. D'où `allowCustomValue` sur
   `SearchCombobox` et `disabled` sur `ComboboxOption` (« Local » reste *visible* hors France, mais
   grisé — une option absente se lit « ce concept n'existe pas », une option grisée « pas ici »).
3. **Une fiche sans Country/Area propres ne peut plus être rattachée à un événement**, y compris un
   véhicule Local (qui ne stocke aucune localisation). C'est la règle legacy telle quelle
   (« Set this driver/vehicle's own Country and Area first »), et c'est ce qui rend honnêtes les
   champs « Event country/area » désormais en lecture seule.
4. **Le repli « autre chauffeur de la même société » de `openSubcontractEmailDraft` n'a pas été
   porté** : il existait parce que le legacy tolérait un partenaire sans email, ce que
   `assertValidDriverFields` interdit. Ç'aurait été du code mort. Un destinataire `null` reste
   possible (un `partnerRef` peut désigner un chauffeur interne) et, dans ce cas, aucun brouillon
   n'est ouvert — comme au legacy.
5. **Le tarif partenaire de l'email est en euros**, pas dans la devise du pays comme au legacy.
   Écrire « 500 $ » à côté d'un montant stocké et facturé en euros, c'est réintroduire exactement
   la confusion que la décision 7.1 a supprimée.
6. **Sur `PATCH /assign`, la régénération de ref et `trip:edit-price` sont sans objet** — l'endpoint
   ne touche ni au compte client ni au prix. C'est écrit dans l'audit plutôt que codé.

## 3. Bugs pré-existants corrigés au passage

- **4 spécs Playwright étaient déjà rouges sur `main`** avant cette session (vérifié en stashant les
  modifications et en relançant). Trois (`booking-lifecycle`, `invoicing-lifecycle`,
  `events-lifecycle`) tapaient encore sur la barre de création inline devenue un dialogue lors de la
  refonte UI. La quatrième (`settings-company-lifecycle`) affirmait le verrou définitif que l'item
  B3 avait supprimé — la spéc a été réécrite sur le comportement réel (vue lecture seule, crayon,
  Cancel, et une deuxième sauvegarde qui passe).
- `events-lifecycle` avait aussi une violation du mode strict Playwright : `name: 'New'` matche
  désormais deux boutons depuis l'ajout de « New booking ».
- `tripFormDefaults()` semait `area: 'Local'` alors qu'aucun pays n'est choisi à ce moment-là et que
  « Local » est réservé à la France — une valeur par défaut que le champ lui-même refuse.

## 4. État de l'arbre

Propre, 11 commits sur `main` (aucune branche, conformément à la convention du projet). Rien n'est
poussé : `main` local a divergé d'`origin/main`, à toi de voir.

## 5. Vérifications, toutes vertes au dernier passage

```bash
cd apps/api && pnpm exec tsc --noEmit -p tsconfig.json     # ok
cd apps/api && pnpm exec eslint "src/**/*.ts" "test/**/*.ts"
cd apps/api && pnpm exec jest                              # 54 unitaires
cd apps/api && pnpm test:e2e                               # 159 e2e, ~55 s
cd apps/web && pnpm exec tsc --noEmit -p tsconfig.app.json # le tsconfig est obligatoire
cd apps/web && pnpm exec vitest run                        # 299
cd apps/web && pnpm exec playwright test                   # 25, ~2 min
```

Méthode appliquée sur chaque règle portée, comme demandé : **rouge d'abord**. On court-circuite
l'implémentation règle par règle, on constate quelles assertions tombent, on restaure, on constate
le vert. Deux fois cet exercice a montré qu'un test ne testait rien (l'ordre des étapes dans
`currentStep`, l'option désactivée que cmdk bloquait déjà tout seul) et les assertions ont été
renforcées en conséquence.

### Piège d'outillage découvert
`apps/web` **n'a pas de configuration Prettier** — seul `apps/api` en a une (`.prettierrc`). Lancer
`npx prettier --write` sur un fichier du front le reformate entièrement avec les valeurs par défaut
(guillemets doubles, points-virgules) et noie la vraie modification dans 1 000 lignes de bruit. Ne
pas formater le front : écrire au style du fichier.

Rappels de la session précédente, toujours valables : le conteneur `api` n'a pas
`apps/api/generated` bind-monté (après un changement de schéma Prisma :
`docker compose exec -w /app/apps/api api npx prisma generate` puis `docker compose restart api`) ;
et après toute modification de DTO/controller, régénérer le client orval
(`pnpm --filter @cockpit/web api:generate`, API up sur `:3000`). Si le front affiche
`does not provide an export named …` après une régénération, c'est le cache Vite du conteneur :
`docker compose restart web`.

## 6. Donnée de dev toujours à réparer

La fiche société de la base de dev reste à ressaisir par Romain dans Settings → Company : seuls
`name` (« Cockpit Transport ») et `city` (« Paris ») ont pu être restaurés, **les 11 autres champs
portent « À RESAISIR »**. Ne pas les inventer. Bonne nouvelle collatérale : la signature des
brouillons d'email de sous-traitance lit ce `name`, et fonctionne donc déjà.

## 7. Pistes pour la suite

Rien n'est bloqué. Quelques choses qui n'étaient pas dans l'audit mais qui se sont vues :

- `packages/shared/src/business/` contient déjà `isLocalTrip` et `pricing`, mais l'ordre des étapes
  d'une course est dupliqué entre `apps/api/src/common/constants/step-order.ts` et
  `apps/web/src/features/bookings/trip-status.ts`. Les deux `isBeforeArrival` en héritent. Une
  seule source dans `shared` serait plus propre — ce n'était pas le sujet de ce lot.
- Aucune UI n'expose de suppression définitive alors que les quatre endpoints existent (et sont
  maintenant protégés). À décider : les exposer derrière `record:delete`, ou les retirer.
- Le warning `No HydrateFallback element provided to render during initial hydration` sort à chaque
  navigation en dev. Inoffensif, mais il pollue toutes les vérifications navigateur.
