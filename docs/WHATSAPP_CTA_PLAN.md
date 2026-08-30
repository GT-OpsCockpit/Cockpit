# Cockpit v2 — Plan WhatsApp "réel" avec boutons CTA

> Document vivant : la section "État actuel" ci-dessous est la version en vigueur. Tout changement de cap s'ajoute au **Journal** en bas du fichier, jamais en réécrivant l'historique.

## Pourquoi ce document

L'intégration WhatsApp actuelle (`NotificationsModule`, voir ADR-0002) n'envoie que du **texte libre, à sens unique** : le dispatcher clique sur un bouton dans Cockpit, un message part vers le POC ou le chauffeur, et c'est tout — personne ne peut répondre, aucun webhook entrant n'existe. C'est un portage 1:1 du comportement du legacy (`suivi-chauffeur-twilio/server.js`), qui avait la même limite.

Une "vraie" intégration WhatsApp business veut dire :

1. Des **messages à boutons (CTA)** — chaque message envoyé au chauffeur porte un bouton d'action (Accepter/Refuser, puis un bouton par étape suivante), au lieu d'un texte qu'il faut traiter à la main côté dispatcher.
2. **Chaque tap déclenche un cycle complet** : le clic sur le CTA tape le webhook entrant de Cockpit → Cockpit met à jour la course (étape, horodatage) → Cockpit renvoie automatiquement un message au client (POC) pour l'informer du changement → et, si l'étape n'est pas terminale, renvoie aussi au chauffeur le message de l'étape suivante avec son propre CTA. **Portée validée avec Romain (2026-08-27) : ça couvre toutes les étapes de la course** (Accepter/Refuser → En route → Arrivé → À bord → Déposé), pas seulement l'acceptation du dispatch — voir § "Chaîne d'étapes" ci-dessous.
3. Des **modèles de message pré-approuvés par Meta** — WhatsApp interdit l'envoi de texte libre initié par l'entreprise en dehors d'une fenêtre de 24h suivant le dernier message du client ; en pratique, *tous* les messages sortants de Cockpit (dispatch, prompts chauffeur, mises à jour client) devront devenir des templates approuvés, pas seulement ceux avec des boutons.
4. Un **webhook entrant** pour recevoir les taps sur les boutons, avec vérification de signature.
5. Le **paramétrage côté Meta Business Manager**, qui est un préalable obligatoire et qui n'est pas du ressort du développeur (vérification d'entreprise, création du compte WhatsApp Business, écriture et soumission des templates, facturation).

Décision d'architecture qui reste valable et n'est **pas remise en cause** ici (cf. ADR-0002) : on garde **Twilio comme BSP** (Business Solution Provider), encapsulé derrière `WhatsAppProvider`. Twilio reste la couche technique qui parle à l'API Meta Cloud à notre place ; côté Meta, la différence avec du "direct Cloud API" est mineure (le WABA existe toujours chez Meta, Twilio ne fait qu'y être connecté en tant que BSP). Ne pas basculer vers Meta Cloud API en direct sans repasser par une session de cadrage — ça casserait l'encapsulation déjà décidée.

---

## État actuel

### Ce qui existe déjà (à ne pas casser)

- `WhatsAppProvider` (interface) / `TwilioWhatsAppProvider` / `DevLogWhatsAppProvider`, sélectionnés dans `NotificationsModule` selon la présence de credentials (jamais de fallback dev-log en production — garder ce garde-fou).
- `MESSAGES` (`apps/api/src/common/constants/messages.ts`) — les 6 textes actuels (updated/accepted/enroute/arrived/onboard/dropped/driverDispatch), tous en texte libre.
- `TripsService.notify()` / `advanceStep()` / `dispatchDriver()` — appellent `notifications.send(phone, body)`, puis enregistrent un `TripStep` et émettent l'event realtime.
- `apps/api/test/utils/in-memory-whatsapp.provider.ts` — double de test pour les e2e.

### Ce qui manque pour une intégration réelle

- Pas de notion de **template Twilio Content** (Content SID + variables) — uniquement `body` texte libre.
- Pas de **boutons** (Quick Reply / Call-to-Action) dans aucun message.
- Aucun **endpoint webhook entrant** (`POST /webhooks/whatsapp/inbound`) — Twilio n'a nulle part où notifier Cockpit d'un tap de bouton ou d'une réponse.
- Aucune **vérification de signature Twilio** (`X-Twilio-Signature`) — prérequis de sécurité pour tout endpoint public qui déclenche des actions métier.
- Aucun log/audit des events entrants, donc pas de moyen simple de dédupliquer les retries webhook de Twilio.
- Le flux "chauffeur accepte/refuse" est aujourd'hui **manuel côté dispatcher** (bouton "Dispatch to the driver?" dans `dispatch-confirm-dialog.tsx`, puis rien ne fait avancer l'étape `ACCEPTED` sauf action manuelle dans Cockpit) — il n'y a pas encore de logique de "refus" (`DRIVER_STEP_VALUES` n'a pas de valeur `DECLINED`).

---

## Plan technique (pour l'agent qui implémente)

**Prérequis obligatoire avant de coder quoi que ce soit ici** : interroger context7 (`resolve-library-id` puis `query-docs` sur `twilio`) pour confirmer, avec la doc à jour, la forme exacte de :
- l'API Content Template (types `twilio/quick-reply` et `twilio/call-to-action`), création via l'API `Content` de Twilio ou via la Console ;
- l'envoi d'un message avec `contentSid` + `contentVariables` via `client.messages.create(...)` ;
- le payload exact reçu sur le webhook entrant WhatsApp quand un utilisateur tape un bouton Quick Reply (champs `Body`, `ButtonText`, `ButtonPayload`, `MessageSid`, `From`, etc. — à vérifier, ne pas supposer) ;
- `twilio.validateRequest` / `validateExpressRequest` pour la vérification de signature en NestJS (Express sous le capot).

Ne pas coder sur la base de suppositions sur ces points — c'est exactement le genre d'API versionnée que context7 doit vérifier (règle du `CLAUDE.md` du repo).

### 1. Étendre `WhatsAppProvider`

Ajouter une méthode dédiée aux templates, sans casser `send()` (encore utile en dev / logs) :

```ts
export interface WhatsAppProvider {
  send(phone: string, body: string): Promise<void>; // conservé pour dev-log / cas simples
  sendTemplate(phone: string, contentSid: string, variables: Record<string, string>): Promise<{ messageSid: string }>;
}
```

`TwilioWhatsAppProvider.sendTemplate` appelle `client.messages.create({ from, to, contentSid, contentVariables: JSON.stringify(variables) })`. `DevLogWhatsAppProvider.sendTemplate` logue et retourne un `messageSid` factice, pour que le flux reste testable sans compte Meta approuvé.

### 2. Chaîne d'étapes pilotée par CTA

Portée validée : **toutes** les étapes deviennent pilotables par le chauffeur depuis WhatsApp, pas seulement Accepter/Refuser. Le point clé de design (et la bonne nouvelle) : `TripsService.notify(ref, step)` fait **déjà** exactement "mettre à jour la course puis envoyer le message correspondant au client" (stamp du `TripStep` + `notifications.send` vers `trip.pocPhone`) — c'est la logique appelée aujourd'hui par les boutons manuels de l'UI Cockpit. Le webhook n'a donc pas besoin de réinventer cette partie : il doit juste **déclencher ce même appel** depuis un tap WhatsApp au lieu d'un clic dispatcher, puis, en plus, envoyer au chauffeur le prochain prompt CTA.

Séquence complète (payload du bouton entre parenthèses) :

| Le chauffeur reçoit… | avec le(s) bouton(s)… | tap → webhook appelle… | → message auto au client (POC) | → prochain message chauffeur envoyé |
|---|---|---|---|---|
| `dispatch` (au moment du `dispatchDriver`) | Accepter (`ACCEPT:<ref>`) / Refuser (`DECLINE:<ref>`) | `ACCEPT` → `notify(ref, 'ACCEPTED')` ; `DECLINE` → flux dédié (§3) | `MESSAGES.accepted` (si ACCEPT) | prompt `driver_enroute` |
| `driver_enroute` — "Tape quand tu pars vers le point de RDV" | En route (`ENROUTE:<ref>`) | `notify(ref, 'ENROUTE')` | `MESSAGES.enroute` | prompt `driver_arrived` |
| `driver_arrived` — "Tape quand tu es arrivé" | Arrivé (`ARRIVED:<ref>`) | `notify(ref, 'ARRIVED')` | `MESSAGES.arrived` | prompt `driver_onboard` |
| `driver_onboard` — "Tape quand le passager est à bord" | Passager à bord (`ONBOARD:<ref>`) | `notify(ref, 'ONBOARD')` | `MESSAGES.onboard` | prompt `driver_dropped` |
| `driver_dropped` — "Tape à la dépose" | Dépose effectuée (`DROPPED:<ref>`) | `notify(ref, 'DROPPED')` | `MESSAGES.dropped` | *(fin de chaîne, pas de prompt suivant — accusé simple sans bouton au chauffeur, optionnel)* |

Deux familles de templates à créer, donc :
- **Prompts chauffeur** (`driver_enroute`, `driver_arrived`, `driver_onboard`, `driver_dropped`, + `dispatch` déjà prévu) — un CTA chacun, catégorie Utility. Nouveau texte à rédiger (n'existe pas encore dans `messages.ts`, contrairement aux messages POC).
- **Messages client/POC** (`updated`, `accepted`, `enroute`, `arrived`, `onboard`, `dropped`) — reprennent le texte actuel de `MESSAGES`, portés en Content Templates, catégorie Utility, **sans bouton** (pure information, sauf si une page de suivi publique existe plus tard pour justifier un bouton URL — elle n'existe pas aujourd'hui).

Soit ~11 templates au total. Chaque a son env var dédié (`TWILIO_TEMPLATE_DISPATCH_SID`, `TWILIO_TEMPLATE_DRIVER_ENROUTE_SID`, `TWILIO_TEMPLATE_ACCEPTED_SID`, ...), ajoutés à `env.validation.ts`, tous optionnels — fallback sur `send()` texte libre en dev si absents (même pattern que Twilio lui-même). Écrire `docs/whatsapp-templates.md` avec le texte exact + boutons de chacun **avant** de coder — c'est le document que la personne non-dev recopie dans Meta/Twilio (§ Meta ci-dessous), et il conditionne le lancement des délais d'approbation Meta.

**Fallback manuel conservé** : les boutons "avancer l'étape" existants dans l'UI Cockpit (dispatcher) ne sont **pas supprimés** — ils restent le filet de secours si un chauffeur n'a pas WhatsApp, mistape, ou perd le fil. Comme les deux chemins (tap WhatsApp et clic UI) appellent la même méthode `TripsService.notify()`, aucune logique n'est dupliquée ; le garde-fou anti-régression déjà présent dans `advanceStep`/`notify` (retour `skipped: true` si l'étape est déjà passée ou hors séquence) protège aussi contre un double-tap WhatsApp ou un tap après action manuelle équivalente.

### 3. Endpoint webhook entrant

Nouveau module `WebhooksModule` (ou sous-dossier de `NotificationsModule`) :

- `POST /webhooks/whatsapp/inbound` — **route publique** (pas de `SessionAuthGuard`, Twilio ne porte pas de cookie de session) mais protégée par vérification de signature Twilio (`X-Twilio-Signature` + l'URL publique exacte + le body — attention si un reverse proxy réécrit l'URL). Rejeter en 403 toute requête à la signature invalide.
- Parser le payload, extraire `MessageSid` (déduplication), `From` (numéro E.164), et `ButtonPayload` s'il existe.
- **Idempotence** : nouvelle table Prisma `WhatsAppInboundEvent` (`messageSid` unique, `from`, `payload Json`, `processedAt`, `createdAt`) — Twilio peut renvoyer le même webhook plusieurs fois ; si `messageSid` déjà vu, répondre 200 sans rejouer l'action métier.
- **Résolution métier** : le payload bouton encode `<ACTION>:<ref>` (ex. `ENROUTE:C00123`), jamais juste `<ACTION>` seul — pour ne pas dépendre de "le dernier message envoyé à ce numéro". Vérifier aussi que le numéro `From` correspond bien au chauffeur/partner assigné à cette course avant d'agir (anti-spoofing basique en plus de la signature Twilio).
- **Routeur générique** : un `switch`/map `ACTION → step` (`ACCEPT→ACCEPTED`, `ENROUTE→ENROUTE`, `ARRIVED→ARRIVED`, `ONBOARD→ONBOARD`, `DROPPED→DROPPED`) qui appelle `TripsService.notify(ref, step)`, puis — si la table de séquence ci-dessus indique un prompt suivant — appelle `notifications.sendTemplate(assignee.phone, nextPromptContentSid, vars)`. `DECLINE` sort de ce routeur générique vers le flux dédié (§4).
- Répondre vite (200 sans corps, ou TwiML vide) — ne pas faire attendre Twilio sur du travail lourd ; l'envoi du prompt suivant peut se faire après la réponse HTTP (fire-and-forget avec log d'erreur, pas de retry bloquant).

### 4. Nouveau flux métier : refus chauffeur

`DRIVER_STEP_VALUES` n'a aujourd'hui aucune notion de refus, et ça reste vrai même avec la chaîne complète — seul le premier maillon (`dispatch`) a un bouton "Refuser", les étapes suivantes n'en ont pas (on ne "refuse" pas d'être en route une fois qu'on a accepté). À trancher avec Romain avant d'implémenter (point ouvert, ne pas décider seul) :
- Que devient la course quand le chauffeur tape "Refuser" ? Proposition par défaut : elle repasse à l'état "non dispatchée" (comme avant le `dispatchDriver`), le dispatcher est notifié (au minimum via l'event realtime déjà existant, `emitTripChanged` — un badge "Refusé par le chauffeur" dans la liste Bookings suffit pour la v1, pas besoin d'email/SMS en plus). Pas de message auto au client (POC) dans ce cas — le refus est une affaire interne dispatcher/chauffeur tant que la course n'est pas réassignée.

### 5. Frontend

- Afficher l'étape courante + sa source ("via WhatsApp" / "manuel Cockpit") dans la liste Bookings (le realtime existant suffit à rafraîchir sans polling) — utile pour distinguer un chauffeur qui suit vraiment le flux WhatsApp de celui qu'il faut relancer manuellement.
- Badge "Refusé par le chauffeur" quand `DECLINE` est reçu.
- Pas de nouveau formulaire ni de nouvelle page nécessaire pour la v1 de cette fonctionnalité — tout part de boutons WhatsApp, pas de l'UI Cockpit.

### 6. Tests

- Étendre `in-memory-whatsapp.provider.ts` avec `sendTemplate` (capturer contentSid + variables pour assertions).
- E2E sur `/webhooks/whatsapp/inbound` : signature valide → action exécutée ; signature invalide → 403, aucune action ; `MessageSid` rejoué → pas de double traitement ; payload sur une course déjà acceptée/annulée → no-op propre (pas d'exception 500).
- E2E de la **chaîne complète** : `ACCEPT` → vérifier `TripStep` ACCEPTED + message `accepted` envoyé au POC + prompt `driver_enroute` envoyé au chauffeur ; puis `ENROUTE` → idem jusqu'à `DROPPED` (aucun prompt suivant envoyé après `DROPPED`) ; tap hors séquence (ex. `ARRIVED` avant `ENROUTE`) → `skipped: true`, pas de double message.
- Garder la couverture e2e existante sur `dispatchDriver`/`notify`/`advanceStep` (ne doivent pas régresser si le template n'est pas configuré → fallback texte libre en dev).

### 7. Déploiement / environnement

- Le webhook exige une **URL publique HTTPS** — inutilisable en local sans tunnel (ex. `ngrok`, ou ne pas tester le webhook réel en local et se contenter du simulateur ci-dessous). À documenter une fois le VPS provisionné (le webhook Twilio pointera vers `https://<domaine prod>/api/webhooks/whatsapp/inbound`).
- Ajouter un moyen de **simuler un tap de bouton en dev** sans dépendre de l'approbation Meta (qui peut prendre des jours) : soit un endpoint dev-only protégé par `NODE_ENV !== 'production'`, soit un test e2e qui appelle directement le handler du webhook avec un payload construit à la main. Objectif : que tout le flux (accept/decline → changement d'état → event realtime → UI) soit démontrable avant même que les templates soient approuvés par Meta.
- Une fois en prod, consigner la décision finale (catégories de template retenues, gestion du refus, etc.) dans un ADR dédié sous `docs/adr/` — convention déjà en place dans ce repo.

---

## Côté Meta — étapes pour une personne non technique

Cette partie est à faire par Romain (ou toute personne ayant l'accès admin à la page/compte Facebook de l'entreprise), **indépendamment du code**, et peut démarrer avant que l'agent ait terminé la partie technique — certaines étapes (vérification d'entreprise, approbation des templates) prennent plusieurs jours, donc à lancer tôt. Un compte Twilio existe déjà (il sert au canal actuel) : ces étapes consistent à le faire passer d'un usage "texte libre" à un vrai compte WhatsApp Business connecté à Meta.

### 1. Compte Meta Business Manager
- Aller sur **business.facebook.com** et créer (ou identifier) le compte Business Manager de l'entreprise.
- Renseigner les informations légales : nom légal exact de l'entreprise, adresse, numéro d'enregistrement (SIRET ou équivalent).

### 2. Vérification de l'entreprise ("Business Verification")
- Dans **Paramètres de l'entreprise → Sécurité de l'entreprise → Vérification du compte**.
- Meta demande un document légal (ex. Kbis ou équivalent local) et parfois une vérification du **nom de domaine du site web** de l'entreprise (ajout d'un enregistrement DNS TXT ou d'une balise HTML — nécessitera l'agent ou l'hébergeur du site si c'est le cas).
- **Compter plusieurs jours.** Sans cette vérification, Meta plafonne le volume à 250 destinataires uniques par 24h, ce qui suffit pour démarrer mais bloquera si l'activité grossit.

### 3. Créer le compte WhatsApp Business (WABA) via Twilio
- Se connecter à la **Twilio Console** (le compte existe déjà, utilisé pour l'envoi actuel).
- Aller dans **Messaging → Senders → WhatsApp senders → Créer un nouveau sender**.
- Suivre l'assistant "Twilio Embedded Signup" — il redirige vers un flux Meta où il faut se connecter avec le compte Facebook ayant les droits admin sur le Business Manager créé à l'étape 1, et choisir/créer le compte WhatsApp Business Account (WABA) à connecter.
- Cette étape lie officiellement le numéro WhatsApp au Business Manager et à Twilio en tant que fournisseur technique (BSP).

### 4. Choisir et valider le numéro WhatsApp Business
- Le numéro utilisé aujourd'hui pour Cockpit doit être **libéré de toute utilisation WhatsApp classique** au préalable (désinstaller l'app WhatsApp/WhatsApp Business grand public sur ce numéro s'il y est encore associé) — sinon Meta refuse de le connecter à l'API Business.
- Recevoir et saisir le code de validation (SMS ou appel vocal) envoyé par Meta sur ce numéro pendant l'assistant de l'étape 3.

### 5. Configurer le profil WhatsApp Business (visible par les destinataires)
- Nom affiché, logo, catégorie d'activité, description courte, site web, adresse.
- Le nom affiché est lui-même soumis à validation Meta (doit correspondre à une activité réelle et reconnaissable — un nom trop générique ou non conforme peut être rejeté).

### 6. Écrire et soumettre les modèles de message
- L'agent fournira un fichier `docs/whatsapp-templates.md` avec, pour chaque message (**une douzaine au total** : 5 prompts chauffeur avec bouton + 6 messages client sans bouton + le dispatch initial), le texte exact et la liste des boutons à créer — **à copier-coller tel quel**, ne pas reformuler (un texte modifié après approbation doit être resoumis à Meta et attendre une nouvelle validation).
- Dans **Twilio Console → Content Template Builder** (ou directement dans Meta Business Manager → WhatsApp Manager → Modèles de message) :
  - Créer un nouveau modèle par message.
  - Catégorie : **"Utilitaire"** pour tous les messages listés dans ce document (mise à jour d'une réservation existante = notification transactionnelle, pas de la promotion) — cette catégorie est approuvée plus vite et coûte moins cher que "Marketing". Ne pas choisir "Marketing" sauf indication contraire de l'agent.
  - Coller le texte fourni, avec ses variables `{{1}}`, `{{2}}`...
  - Ajouter le(s) bouton(s) indiqué(s) sur les modèles qui en ont (type "Réponse rapide" : Accepter/Refuser, En route, Arrivé, Passager à bord, Dépose effectuée — un seul bouton par prompt chauffeur, sauf le premier qui en a deux).
  - Soumettre pour validation. Compter de quelques minutes à ~48h par modèle — soumettre les ~12 d'un coup plutôt qu'un par un pour paralléliser l'attente.
- Une fois un modèle **approuvé**, noter son **Content SID** (visible dans la Content Template Builder Twilio, commence par `HX...`) et le transmettre à l'agent — c'est la valeur qui va dans les variables d'environnement (`TWILIO_TEMPLATE_*_SID`).

### 7. Configurer le webhook entrant dans Twilio
- Une fois que l'agent a communiqué l'URL du webhook (ex. `https://<domaine du site>/api/webhooks/whatsapp/inbound`, disponible seulement après déploiement) :
- **Twilio Console → le numéro/sender WhatsApp concerné → section "Quand un message arrive" ("A message comes in")** → coller l'URL, méthode **HTTP POST**, sauvegarder.

### 8. Facturation
- Meta facture les conversations initiées par l'entreprise (par catégorie), Twilio facture en plus ses propres frais par message.
- Dans **Twilio Console → Billing**, ajouter/vérifier un moyen de paiement et s'assurer que le compte est en mode payant (pas en essai gratuit) — sans ça, l'envoi échoue silencieusement une fois le quota d'essai épuisé.

### 9. Suivre la qualité et la limite d'envoi
- Meta attribue un **statut qualité** (vert/jaune/rouge) et un **plafond de destinataires uniques par 24h** qui augmente automatiquement avec un usage propre (250 → 1 000 → 10 000 → illimité). Visible dans WhatsApp Manager (Meta Business) ou dans Twilio Console → Senders.
- Éviter les messages perçus comme non désirés (ne pas relancer un même chauffeur/client à répétition) pour ne pas faire baisser ce score, ce qui réduirait le plafond.

### Ordre recommandé / dépendances
Les étapes 1–2 (Business Manager + vérification) et 6 (rédaction des textes de templates, une fois le fichier `docs/whatsapp-templates.md` livré par l'agent) peuvent démarrer **en parallèle** du développement — ce sont elles qui prennent le plus de temps calendaire. Les étapes 3–5 et 7 dépendent d'informations techniques (URL du webhook) qui n'existeront qu'une fois le code déployé ; elles peuvent donc attendre. L'étape 8 (facturation) doit être faite avant tout envoi réel en production.

---

## Journal

> **2026-08-27 — Version initiale.** Cadrage du passage d'un envoi WhatsApp texte-libre à sens unique (état actuel) à une vraie intégration avec templates approuvés Meta et boutons CTA (Accepter/Refuser sur la dispatch chauffeur). Décision : on garde Twilio comme BSP (pas de bascule vers Meta Cloud API en direct), on étend `WhatsAppProvider` avec `sendTemplate`, on ajoute un webhook entrant avec vérification de signature + table d'idempotence `WhatsAppInboundEvent`. Point ouvert non tranché : comportement exact de la course quand le chauffeur refuse (proposition par défaut documentée ci-dessus, à valider avec Romain avant implémentation).

> **2026-08-27 — Contrainte "chaque CTA déclenche un webhook + relance un message client" étendue à toutes les étapes.** Romain a précisé que ce n'est pas seulement Accepter/Refuser : chaque tap chauffeur (Accepté → En route → Arrivé → À bord → Déposé) doit mettre à jour la course *et* relancer automatiquement le message correspondant au client, validé explicitement comme portée complète plutôt que limitée au dispatch (option "Toutes les étapes" choisie face à "Seulement Accepter/Refuser"). Design retenu : réutiliser tel quel `TripsService.notify(ref, step)` (fait déjà stamp + envoi client) comme cible du webhook pour chaque action, et ajouter des templates "prompt chauffeur" à bouton unique par étape (nouveaux, n'existaient pas dans `messages.ts`) qui s'enchaînent automatiquement après chaque tap réussi. Le fallback manuel (boutons UI Cockpit existants) est conservé comme filet de secours, pas supprimé. Porte le total de templates à soumettre à Meta à ~12 (voir § 6 côté Meta).
