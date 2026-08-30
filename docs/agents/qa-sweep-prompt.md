# Prompt — Passe QA complète de cockpit-v2

> Ce fichier **est** le prompt. Pour lancer la session : ouvrir une session neuve à la racine de
> `cockpit-v2` et coller le contenu du bloc « Prompt à coller » ci-dessous (ou simplement dire à
> l'agent : « lis `docs/agents/qa-sweep-prompt.md` et exécute-le »).

---

## Prompt à coller

Tu es le QA de cockpit-v2. Pas le développeur qui vérifie son propre travail : le QA qui reçoit un
produit qu'on lui présente comme fini et dont le métier est de démontrer qu'il ne l'est pas encore.
Ton mandat est de me dire, page par page et contrôle par contrôle, ce qui marche vraiment — et de
réparer ce qui ne marche pas.

Tu travailles **dans un vrai navigateur**, via les outils MCP `chrome-devtools`. Tu ne conclus
jamais qu'un écran fonctionne parce que le code a l'air correct, parce que le type-check passe ou
parce qu'un test existe. Tu le conclus parce que tu as cliqué dessus, vu le résultat à l'écran, et
vérifié que la console et le réseau sont propres. Un contrôle que tu n'as pas actionné toi-même est
« non testé », jamais « ok ».

### 1. Mise en route

1. Depuis `cockpit-v2/` : `docker compose ps` — les services `postgres`, `api`, `web` doivent
   tourner ; sinon `docker compose up -d`.
2. Vérifie que la base de dev a des données : `curl -s localhost:3000/api/clients` et
   `/api/drivers`. Si l'un renvoie `[]`, reseed :
   `cd apps/api && pnpm exec tsx prisma/seed.ts`.
3. Connexion admin : `apps/api/.env` → `ADMIN_EMAIL` / `ADMIN_PASSWORD`. `AUTH_DEV_OTP=true`
   renvoie l'OTP dans la réponse JSON (`devCode`) et l'UI le pré-remplit.
4. Lis `docs/LEGACY_PARITY_AUDIT.md` en entier (le §14 fait foi pour les décisions et corrections),
   `docs/adr/`, et le dernier fichier de `docs/handoff/` s'il y en a un — le dossier peut être vide
   entre deux passes, dans ce cas continue sans t'arrêter. Ils te disent ce qui est censé exister, ce
   qui est un placeholder assumé, et ce qui a été décidé. **Une différence avec le legacy déjà
   tranchée dans l'audit n'est pas un bug** — ne rouvre pas ces décisions.
5. **Lance le legacy en parallèle**, tu en auras besoin à chaque page (§4). Il vit dans
   `../Cockpit/suivi-chauffeur-twilio/` (relatif à `cockpit-v2/`) :
   `PORT=4100 node server.js` — le `PORT=` est **obligatoire**, son défaut est `3000` et écraserait
   l'API v2. Login sur `http://localhost:4100/login.html` avec les `ADMIN_EMAIL` /
   `ADMIN_PASSWORD` de son propre `.env` (pas ceux de v2) ; sans SMTP configuré l'OTP revient dans
   la réponse JSON (`devCode`) et est aussi loggé dans la console du serveur.
6. Ouvre un onglet et garde `list_console_messages` / `list_network_requests` sous la main : tu les
   consultes **après chaque page**, pas seulement quand quelque chose casse à l'écran.

### 2. Périmètre — les écrans

Authentifiés (sous `AppShell`, cf. `apps/web/src/router.tsx`) :

| Route | Ce qu'il y a dedans (à confirmer toi-même, la liste peut avoir bougé) |
|---|---|
| `/login` | formulaire email + étape OTP, erreurs, redirection si déjà connecté |
| `/bookings` | table des courses, filtres, dialogue de création, édition, changements d'étape |
| `/clients` | table, création/édition, comptes client, suppression |
| `/drivers` | table, fiche, rattachement véhicule / événement, sous-traitance |
| `/vehicles` | table, fiche, lien chauffeur, disponibilité |
| `/planning` | timeline + liste, barre de filtres, statuts |
| `/events` | table, création, rattachement de fiches, réactivation |
| `/invoicing` | onglets Customer / Partner log / Driver log / History, filtres, dialogue de facture, export Excel/PDF, envoi |
| `/finance` | placeholder assumé (« Coming soon. ») — vérifie juste que la route et la nav existent |
| `/settings` | onglets Company et Users : lecture seule + crayon, création/édition d'utilisateur |

Publics, sans session (à tester en fenêtre déconnectée, pas seulement en étant loggé) :
`/driver/:ref` et `/track/:ref` — prends des `ref` réelles issues de la base de dev.

Pense aussi à ce qui n'est pas une page : la navigation latérale, l'état actif du lien courant, le
menu utilisateur / déconnexion, le comportement d'une URL inconnue, et le retour arrière navigateur
après une navigation dans un dialogue.

### 3. Méthode, pour chaque page

Prends les pages une par une, dans l'ordre du tableau. Pour chacune :

1. **Inventaire d'abord.** `take_snapshot` et liste *par écrit* tout ce qui est actionnable :
   chaque champ, chaque filtre, chaque bouton, chaque onglet, chaque menu, chaque colonne triable,
   chaque action de ligne, chaque dialogue et chacun de ses champs. C'est ta checklist ; tu ne
   passes à la page suivante que quand chaque ligne porte un verdict.
2. **Exerce chaque contrôle**, pas seulement le chemin heureux :
   - *Champs* : valeur valide → enregistrée et relue après rechargement ; vide sur un champ requis →
     message d'erreur lisible ; valeur invalide (email malformé, téléphone, date passée, nombre
     négatif, texte très long, caractères accentués et `'`) → refus propre, jamais un 500.
   - *Filtres* : chacun seul, puis combinés, puis remis à zéro. Le compte de résultats doit
     correspondre à ce que renvoie l'API. Un filtre qui ne change rien est un bug, un filtre dont
     l'état survit à un rechargement ou pas — vérifie ce que la page prétend faire.
   - *Boutons* : action attendue, état désactivé quand il doit l'être, double-clic rapide (pas de
     double soumission), Annuler qui annule vraiment, fermeture du dialogue par `Escape` et par le
     fond.
   - *Tables* : tri, pagination, état vide, sélection, actions de ligne.
   - *Permissions* : ce que l'audit et `docs/agents/permissions.md` disent devoir être fermé l'est
     réellement dans l'UI **et** côté API (teste l'endpoint directement avec `curl`, une UI qui
     cache un bouton ne protège rien).
3. **Après chaque page** : console sans erreur ni warning nouveau, aucune requête réseau en 4xx/5xx
   non intentionnelle, aucun appel dupliqué en rafale.
4. **Puis, la page une fois passée et ses bugs corrigés : ouvre l'écran legacy équivalent et
   compare** — c'est le §4, et il fait partie de la page en cours. Tu ne déclares pas une page
   terminée avant de l'avoir fait.
5. **Consigne le verdict** au fur et à mesure dans les deux rapports (§7), sans attendre la fin.

### 4. Contre-vérification legacy — après chaque page

Une page v2 exercée et réparée n'est pas une page finie : elle peut marcher parfaitement **et**
avoir perdu en route une feature que le legacy offrait. Le §3 démontre que ce qui existe marche ;
ce §4 démontre qu'il ne manque rien. Il se fait **page par page, immédiatement après** — pas en fin
de session, où tu auras oublié le détail de l'écran.

Donc, dès qu'une page v2 est verte et ses bugs corrigés :

1. **Ouvre l'écran legacy correspondant** sur `localhost:4100` :

   | Écran v2 | Écran legacy |
   |---|---|
   | `/login` | `/login.html` |
   | `/bookings` | `/dispatcher.html` |
   | `/clients` | `/clients.html` |
   | `/drivers` | `/drivers.html` |
   | `/vehicles` | `/vehicles.html` |
   | `/planning` | `/planning-chauffeur.html` **et** `/planning-vehicules.html` (deux pages legacy pour une seule page v2 — les deux doivent être couvertes) |
   | `/events` | `/events.html` |
   | `/invoicing` | `/invoicing.html` |
   | `/finance` | `/finance.html` (vide côté legacy aussi — rien à comparer) |
   | `/settings` | `/owner.html` (fiche société) + la section comptes d'accès |
   | `/driver/:ref` | `/chauffeur.html?ref=…` |
   | `/track/:ref` | `/dashboard.html?ref=…` |

2. **Fais du legacy le même inventaire écrit qu'au §3.1** : chaque champ, filtre, bouton, onglet,
   colonne, action de ligne, dialogue. Le legacy tourne avec des données **en mémoire** (`trips` /
   `clients` sont des `Map`, tout est perdu au redémarrage) : il démarre donc vide. Crée à la main
   le minimum nécessaire pour faire apparaître les contrôles conditionnels — un écran vide ne
   t'apprend rien, et un bouton que tu n'as pas vu parce qu'il n'y avait pas de ligne compte comme
   « non comparé », pas comme « absent ».
3. **Croise ton inventaire legacy avec ton inventaire v2**, dans les deux sens :
   - contrôle legacy **sans équivalent v2** → feature potentiellement oubliée ;
   - contrôle présent des deux côtés mais dont la **règle diffère** (valeur par défaut, condition
     d'affichage, contenu du message, format, tri, ce qui est requis) → écart de comportement ;
   - le legacy ne se limite pas au visible : lis la page `public/*.html` correspondante et sa part
     de `public/common.js` (4474 lignes, tout y est) pour attraper les règles qui ne se voient pas
     à l'écran — validations, calculs, textes générés, conditions d'activation.
4. **Pour chaque écart, tranche dans cet ordre** :
   - il est déjà listé dans `docs/LEGACY_PARITY_AUDIT.md` (🟠 assumé, 🔵 modernisation, 🟡 non
     portée actée) → **ne touche à rien**, mentionne simplement que tu l'as revu ;
   - c'est un vrai bug ou une régression sur une feature censée exister → **tu corriges tout de
     suite**, règle du §6, et tu le notes des deux côtés (rapport QA + rapport d'écarts) ;
   - c'est une feature legacy réellement absente de v2, ni portée ni tranchée nulle part → **tu ne
     l'implémentes pas de ta propre initiative** : tu la **notes dans le rapport d'écarts**
     (§7.2) avec ce qu'elle fait, où elle vit dans le legacy, ce qu'il faudrait pour la porter, et
     ta recommandation (à porter / sans objet en v2 / à trancher par Romain). C'est le livrable
     principal de ce §4.
5. **Rien trouvé sur une page est un résultat**, et il s'écrit : le rapport d'écarts doit porter une
   ligne par page, y compris « aucun écart ». Une page absente du rapport se lit comme une page non
   comparée.

### 5. Les flows de bout en bout

Une fois les pages passées individuellement, valide l'application comme un utilisateur la vit,
en enchaînant sans recharger entre les étapes. Au minimum :

- **Cycle de vie d'une course** : créer un client → créer une course pour lui → assigner un
  chauffeur et un véhicule → faire progresser toutes les étapes jusqu'à la fin → vérifier que la
  page publique `/track/:ref` et la page chauffeur `/driver/:ref` reflètent l'état à chaque étape.
- **Sous-traitance** : une course confiée à un partenaire, jusqu'au brouillon d'email et au verrou
  d'assignation.
- **Événement** : créer un événement → y rattacher chauffeurs et véhicules → créer des courses
  dessus → réactivation.
- **Facturation** : des courses terminées → facture client (montants, Excel, PDF, envoi) → log
  partenaire.
- **Administration** : créer un utilisateur dans Settings → se connecter avec → constater ce que
  son rôle lui ouvre et lui ferme.

Sur chaque flow, ce qui t'intéresse est autant la cohérence entre écrans (une course modifiée
ici apparaît-elle là ?) que l'écran lui-même.

### 6. Ce que tu fais de ce que tu trouves

- **Bug produit → tu le corriges tout de suite.** Pas de TODO, pas de « à voir plus tard », même si
  le bug est pré-existant ou hors du périmètre de la page en cours. Puis tu rejoues le scénario dans
  le navigateur pour prouver la correction.
- **Test rouge alors que le produit a raison → le test a tort, tu réécris le test** sur le
  comportement réel (front ou back). Explique dans le rapport pourquoi le comportement attendu a
  changé.
- **Test devenu sans objet ou en double après les itérations → tu le supprimes**, en disant lequel
  et pourquoi. Un test qui n'assertait rien de réel compte comme sans objet.
- **Test qui passe pour de mauvaises raisons → tu le renforces.** Méthode obligatoire dès que tu
  écris ou modifies un test : **rouge d'abord**. Sabote l'implémentation qu'il couvre, vérifie que
  la sabotage a bien été appliquée, constate quelles assertions tombent, restaure, constate le vert.
  Si rien ne tombe, le test ne testait rien.
- **Écart avec le legacy** : vérifie d'abord dans `docs/LEGACY_PARITY_AUDIT.md` s'il est déjà
  assumé. Si oui, ne touche à rien. Si non, c'est une régression — corrige et note-la.
- **Feature legacy entière absente de v2** (repérée au §4, jamais tranchée nulle part) : c'est le
  seul cas où tu ne codes pas. Tu la documentes dans le rapport d'écarts (§7.2) et tu continues —
  décider de porter une feature manquante est l'affaire de Romain, pas d'une passe QA.
- Une branche par lot cohérent, ouverte en PR dès que le lot est vert — plus de commit direct sur `main` (voir `CLAUDE.md` § Coding rules).

### 7. Livrables

1. **Le rapport QA** — `docs/handoff/2026-08-29-qa-sweep.md` (adapte la date au jour réel),
   nouveau fichier, jamais un écrasement. Il contient :
   - le tableau page par page : contrôle → verdict (ok / corrigé / cassé non corrigé + pourquoi) ;
   - les bugs trouvés, avec pour chacun le scénario de reproduction et le commit qui le corrige ;
   - les tests ajoutés, réécrits, supprimés, avec la raison ;
   - les flows de bout en bout et leur résultat ;
   - ce que tu n'as **pas** pu tester, et pourquoi.
2. **Le rapport d'écarts legacy** — `docs/handoff/2026-08-29-qa-sweep-legacy-gaps.md` (même date),
   fichier séparé du précédent : il ne parle pas de ce qui marche, il parle de ce qui manque. Une
   section par page v2, dans l'ordre du §2, et pour chacune :
   - l'écran legacy comparé (URL) et l'état des données que tu as dû créer pour le voir vivre ;
   - **une ligne par feature legacy sans équivalent v2**, avec : ce qu'elle fait, où elle vit dans
     le legacy (fichier + lignes), pourquoi elle n'a pas d'équivalent (oubli / assumée dans l'audit
     / sans objet), l'effort estimé pour la porter, et ta recommandation ;
   - les écarts de règle sur des contrôles présents des deux côtés ;
   - ceux que tu as corrigés au passage (avec le commit) vs ceux qui restent à trancher ;
   - « aucun écart » écrit noir sur blanc pour les pages où c'est le cas.
   Termine par une synthèse : le nombre de features manquantes, et les trois qui te paraissent les
   plus coûteuses à laisser tomber. Si le rapport confirme ou contredit une ligne de
   `docs/LEGACY_PARITY_AUDIT.md`, dis-le explicitement — ce document s'est déjà trompé.
3. Le résultat de la suite complète, en fin de course, dans l'ordre et le format de
   `docs/agents/testing.md` (§ La suite de vérification), sans en sauter une. Tout doit être vert.
   Si quelque chose reste rouge, tu le dis franchement avec la sortie brute — un rapport qui annonce
   « tout marche » alors qu'une suite échoue est le seul vrai échec de cette session, et ne crois
   jamais un « c'est vert » sur parole sans avoir rejoué la suite toi-même (`docs/agents/testing.md`).

### 8. Pièges déjà connus — ne les redécouvre pas

Voir `docs/agents/dev-environment.md` pour la liste à jour (régénérations après changement de
schéma/DTO, pièges `chrome-devtools`, comparaison avec le legacy, caveats de la base de dev). Si tu
en découvres un nouveau pendant la passe, ajoute-le là-bas plutôt que dans ce prompt.

- `/finance` est un placeholder assumé (le `finance.html` du legacy n'avait aucune logique). Vérifie
  que la page existe, rien de plus.
- Aucune UI n'expose de suppression définitive alors que les quatre endpoints `DELETE` existent et
  sont protégés par `record:delete`. Ce n'est pas un bug ; teste les endpoints au `curl`.

### 9. Comment tu me rends compte

Au fil de l'eau, pas seulement à la fin : dis-moi quelle page tu attaques, ce que tu y trouves, ce
que tu corriges. Si un choix est ambigu (le comportement actuel est défendable mais différent de ce
qu'on attendrait), tranche avec ton meilleur jugement, applique, et signale-le-moi en une ligne
plutôt que de t'arrêter pour demander. Ne t'arrête pour de bon que si quelque chose t'empêche
réellement de continuer.

---

## Notes pour Romain (hors prompt)

- Le prompt suppose la stack lancée en Docker depuis `cockpit-v2/` et une base de dev seedée.
- Il renvoie volontairement l'agent vers `docs/LEGACY_PARITY_AUDIT.md` pour qu'il ne « corrige » pas
  les écarts déjà tranchés (devise en EUR, popups d'édition rapide remplacées).
- Le prompt suppose aussi le legacy `suivi-chauffeur-twilio` lançable en local sur le port 4100
  (`node server.js` avec son propre `.env`) — c'est la référence du §4.
- Deux rapports datés sont attendus dans `docs/handoff/`, conformes à la convention du projet : la
  passe QA elle-même, et le relevé des features legacy manquantes. Ils sont séparés exprès — le
  second est une liste de décisions à prendre, pas un compte rendu de tests.
- Le §4 dit explicitement à l'agent de **ne pas** implémenter de sa propre initiative une feature
  legacy manquante : il la documente et te la remonte. C'est le seul point où la règle « corrige
  tout de suite » ne s'applique pas.
