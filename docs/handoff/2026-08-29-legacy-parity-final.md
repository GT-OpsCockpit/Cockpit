# Handoff — 2026-08-29 · Deuxième passe de parité métier legacy ↔ v2

## Ce qui a été demandé

« Analyser front et back de cockpit legacy et v2, dire s'il y a des divergences métier et si ce
sont des améliorations ou de purs oublis. Il ne faut pas de feature manquante et surtout pas de
logique métier différente. »

Un audit existait déjà (`docs/LEGACY_PARITY_AUDIT.md`, 2026-08-28) et se déclarait refermé.
Cette passe l'a repris à zéro, sans s'y fier.

## Le résultat en une ligne

L'audit avait tort : **5 bugs métier** et une quinzaine de règles legacy étaient encore ouverts,
et le document lui-même était faux sur cinq points. Tout est corrigé ; l'état réel fait désormais
l'objet du **§15** de l'audit, qui est la section à lire.

## Les deux angles morts à retenir

Ils expliquent tous les manques et méritent d'être vérifiés à chaque refonte :

1. **Vérifier l'appelant, pas seulement l'endpoint.** `geocode-search`, `poc-search` et les quatre
   `DELETE` existaient et étaient corrects — aucune UI ne les appelait. L'audit les avait classés
   « portés ». Idem `isEffectivelyActive` (porté côté pickers, absent des tables) et la ligne
   « HH:mm Paris » (calculée, jamais rendue).
2. **Croiser les domaines.** `/meta` filtré aux types actifs et la facturation avaient été validés
   séparément : leur croisement produisait une facture à colonne « Category » vide. Une correction
   avait créé une régression.

## Ce qui a été livré

Sept commits de code sur `main`, chacun autonome et testé, plus celui-ci pour la doc :

| Commit | Contenu |
|--------|---------|
| `230b969` | Les 5 bugs métier (détachement sous-traitant, ASD « to null », annulation destructrice, catégorie de facture, dérive de fuseau) |
| `18592e8` | Filtres serveur des sélecteurs de facturation, état effectif dans les tables, ligne Paris |
| `24107ea` | Validations perdues (dates d'événement, acronyme, téléphone) + endpoint de mot de passe |
| `68e1cd4` | Colonnes Sub-C/Action du Planning, suppression définitive atteignable |
| `0308256` | Recherche d'adresse, auto-remplissage du pays, bloc vol sur « c'est un aéroport » |
| `35fbf52` | Combobox POC, règle des 4 devises retail, verrou FBO/Tail |
| `c0f38d0` | `shortPlaceLabel` + n° de vol, statut exporté, nom de fichier, email partenaire, combobox société, crayon grisé |

## Vérification

- **Suites** : 518 tests web (vitest), 144 unitaires API, 194 e2e API — toutes vertes.
- **Méthode** : chaque règle a été écrite en test rouge d'abord, et les cas passés du premier coup
  ont été re-vérifiés par sabotage (règle neutralisée → échecs comptés → restaurée).
- **Live, en navigateur** (chrome-devtools MCP) : détachement du sous-traitant vérifié en base
  (`partnerId` nul, tarif conservé), ASD écrivant son PU en DO, dialogue d'annulation rouvrant sur
  « 50% », suppression définitive refusée par l'API avec son message métier, recherche « JFK »
  remplissant pays + fuseau + bloc vol, POC amenant son numéro, « ≈ 290.24 USD » sous un Retail net
  japonais, liste Planning avec ses quatre actions.

## Décisions prises par Romain ce jour-là

Quatre divergences réelles ont été **écartées** plutôt que corrigées, et sont documentées comme
telles en §15 : le bouton « Clear » de l'indisponibilité, le tri des listes par `createdAt`, les
bornes de facturation à minuit Paris, et la recherche sensible aux accents.

## Ce qui reste

Rien d'ouvert côté parité. Deux points à connaître, décrits en fin de §15 :

- Le tarif partenaire est désormais requis **aussi à la création** (le legacy ne l'exigeait que
  dans sa popup de sous-traitance) — v2 n'ayant qu'un formulaire.
- La colonne Itinéraire fait précéder une adresse d'un seul segment par la ville du fuseau
  (« Paris, Nice Airport » sur une course en fuseau Paris). C'est la règle legacy, qui supposait
  des adresses issues de son autocomplétion — rétablie dans le même lot.
