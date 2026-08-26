# Cockpit v2 — Plan Backend (NestJS + PostgreSQL/Prisma)

> Document vivant : la section "État actuel" ci-dessous est la version en vigueur. Tout changement de cap s'ajoute au **Journal** en bas du fichier, jamais en réécrivant l'historique.

## État actuel

### Contexte de décision

Issu d'une session de cadrage (2026-08-26) : mono-tenant, solo dev + Claude Code, pas de deadline serrée mais **priorité robustesse dès la v1**. Stack retenue : NestJS + TypeScript + PostgreSQL via Prisma. Voir `LEGACY_FEATURES.md` pour l'inventaire complet du comportement à reproduire (et sa dette à corriger).

### Architecture

Modules NestJS par domaine, chacun `controller + service + DTOs (class-validator)` :

- `AuthModule` — login, 2FA email, sessions, guards.
- `UsersModule` — dispatchers/admin (remplace `accessRecords`, devient un vrai mécanisme d'auth).
- `ClientsModule`, `DriversModule`, `FleetModule` (VehicleType + FleetVehicle), `TripsModule` (cœur métier), `InvoicesModule`.
- `NotificationsModule` — wrapper Twilio derrière une interface `WhatsAppProvider`.
- `GeoModule` — proxy Nominatim / tz-lookup / FlightStats / FX, avec cache persistant (remplace les caches en mémoire du legacy).
- `RealtimeModule` — gateway SSE.
- `CompanyModule` — settings type page Owner.

Transversal : `PrismaModule` (client Prisma partagé), Guards (`SessionAuthGuard`, `RolesGuard` sur `Role.ADMIN|DISPATCHER`), `ConfigModule` (env validé au boot), logs structurés (Pino), tests Jest (unit + e2e contre un Postgres de test dockerisé).

**Amélioration structurelle clé vs legacy** : toute génération de référence (course, client, chauffeur, facture...) passe par une table `RefCounter(scope TEXT PK, lastValue INT)` mise à jour en transaction (`UPDATE ... RETURNING`) — élimine le bug "compteur remis à zéro au redémarrage" du legacy.

### Modèles de données (Prisma schema)

```prisma
enum Role { ADMIN DISPATCHER }
enum ClientType { INDIVIDUAL COMPANY EVENT }
enum Billing { ACCOUNT CASH CARD }
enum Service { TSF ASD SPEC }
enum TripStepKind { TRANSMITTED RECEIVED ACCEPTED ENROUTE ARRIVED ONBOARD DROPPED }
enum CancellationFee { FREE FIFTY SEVENTYFIVE HUNDRED }
enum DriverUnavailKind { OFF HOLIDAYS SICK }
enum FleetUnavailKind { REPAIR SERVICE BODYWORK }

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String
  role          Role
  firstName     String
  lastName      String
  phone         String?
  active        Boolean  @default(true)
  deactivatedAt DateTime?
  lastLoginAt   DateTime?
  createdAt     DateTime @default(now())
  sessions      Session[]
  otpCodes      OtpCode[]
}

model Session {
  id        String   @id @default(cuid())   // = token en cookie httpOnly
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  expiresAt DateTime
  createdAt DateTime @default(now())
}

model OtpCode {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  codeHash  String
  attempts  Int      @default(0)
  expiresAt DateTime
  createdAt DateTime @default(now())
}

model Country {
  code            String   @id           // ex: "FR", "US-NY"
  name            String
  dialCode        String?
  currency        String?
  defaultTimezone String
}

model Client {
  id             String     @id @default(cuid())
  ref            String     @unique       // CI/CC/CE{n}
  clientType     ClientType
  contactFirstName String?
  contactLastName  String?
  company        String?
  acronym        String?
  refPoOther     String?
  address        String?
  postalCode     String?
  city           String?
  countryCode    String?
  vatNumber      String?
  email          String?
  billing        Billing?
  pocName        String?
  pocPhone       String?
  pocEmail       String?
  eventCountry   String?
  eventArea      String?
  eventStartDate DateTime?
  eventEndDate   DateTime?
  active         Boolean    @default(true)
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt
  trips          Trip[]
  invoices       Invoice[]
  drivers        Driver[]      @relation("EventDrivers")
  fleetVehicles  FleetVehicle[] @relation("EventFleetVehicles")
}

model Driver {
  id            String   @id @default(cuid())
  ref           String   @unique          // D-{scope}-{n}, format corrigé (zero-pad + séparateur cohérent)
  countryCode   String?
  firstName     String?
  lastName      String?
  phone         String?  @unique          // dédup legacy → contrainte réelle
  company       String?
  email         String?
  area          String   @default("Local")
  eventsOnly    Boolean  @default(false)
  eventClientId String?
  eventClient   Client?  @relation("EventDrivers", fields: [eventClientId], references: [id])
  active        Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  unavailability DriverUnavailability?
  trips          Trip[]        @relation("AssignedDriver")
  partnerTrips   Trip[]        @relation("PartnerDriver")
  fleetReserved  FleetVehicle? @relation("ReservedForDriver")
}

model DriverUnavailability {
  id        String            @id @default(cuid())
  driverId  String            @unique
  driver    Driver            @relation(fields: [driverId], references: [id])
  type      DriverUnavailKind
  date      DateTime?          // type = OFF
  startDate DateTime?          // type = HOLIDAYS | SICK
  endDate   DateTime?
}

model VehicleType {
  id        String   @id @default(cuid())
  ref       String   @unique             // V{n}
  name      String   @unique
  maxPax    Int
  createdAt DateTime @default(now())
  fleetVehicles FleetVehicle[]
  trips         Trip[]
}

model FleetVehicle {
  id             String   @id @default(cuid())
  ref            String   @unique         // F{n}
  categoryId     String
  category       VehicleType @relation(fields: [categoryId], references: [id])
  regNbr         String   @unique
  make           String
  model          String
  yearOfBuild    Int
  fourWD         Boolean
  nbPax          Int
  color          String   @default("Metallic Black")
  acronym        String?  // max 6 chars, validé en DTO
  isLocal        Boolean  @default(true)
  countryCode    String?
  area           String?
  partnerCompany String?
  driverId       String?  @unique
  driver         Driver?  @relation("ReservedForDriver", fields: [driverId], references: [id])
  eventsOnly     Boolean  @default(false)
  eventClientId  String?
  eventClient    Client?  @relation("EventFleetVehicles", fields: [eventClientId], references: [id])
  active         Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  unavailability FleetUnavailability?
  trips          Trip[]
}

model FleetUnavailability {
  id             String           @id @default(cuid())
  fleetVehicleId String           @unique
  fleetVehicle   FleetVehicle     @relation(fields: [fleetVehicleId], references: [id])
  type           FleetUnavailKind
  startDate      DateTime
  endDate        DateTime
}

model Trip {
  id                   String   @id @default(cuid())
  ref                  String   @unique     // R-{clientRef}-{YY}-{seq}
  countryCode          String?
  area                 String?
  timezone             String?
  pickupAt             DateTime            // date+heure fusionnées (au lieu de 2 champs string legacy)
  pickupLocation       String
  dropoffLocation      String?
  service              Service
  hours                Int?
  instructions         String?
  clientId             String
  client               Client   @relation(fields: [clientId], references: [id])
  passengerName        String
  pocName              String?
  pocPhone             String?
  pocEmail             String?
  tracking             Boolean  @default(true)
  paxCount             Int?
  vehicleTypeId        String?
  vehicleType          VehicleType? @relation(fields: [vehicleTypeId], references: [id])
  fleetVehicleId       String?
  fleetVehicle         FleetVehicle? @relation(fields: [fleetVehicleId], references: [id])
  priceEur             Decimal?
  partnerRateEur       Decimal?
  driverId             String?
  driver               Driver?  @relation("AssignedDriver", fields: [driverId], references: [id])
  billing              Billing?
  flightNumber         String?
  bufferTime           Int?
  fboAddress           String?
  tailNbr              String?
  nameboardUrl         String?             // fichier stocké (volume Docker), plus de base64 en mémoire
  pickupIata           String?
  dropoffIata          String?
  subContractor        Boolean  @default(false)
  partnerId            String?
  partner              Driver?  @relation("PartnerDriver", fields: [partnerId], references: [id])
  dispatched           Boolean  @default(false)
  invoiced             Boolean  @default(false)
  assignmentCancelled  Boolean  @default(false)
  assignmentCancelledAt DateTime?
  cancellationFee      CancellationFee?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  steps                TripStep[]
  invoiceLinks         InvoiceTrip[]
}

model TripStep {
  id         String       @id @default(cuid())
  tripId     String
  trip       Trip         @relation(fields: [tripId], references: [id])
  step       TripStepKind
  occurredAt DateTime     @default(now())

  @@unique([tripId, step])   // remplace l'objet JSON `steps` legacy par un vrai historique auditable
}

model Invoice {
  id          String   @id @default(cuid())
  ref         String   @unique      // INV{n}
  clientId    String
  client      Client   @relation(fields: [clientId], references: [id])
  isEvent     Boolean  @default(false)
  refPo       String?
  periodStart DateTime?
  periodEnd   DateTime?
  totalHT     Decimal
  vatRate     Decimal  @default(0.10)   // champ réel, plus de "10% en dur" — prépare la conformité légale phase 2
  totalTTC    Decimal
  createdAt   DateTime @default(now())
  trips       InvoiceTrip[]
}

model InvoiceTrip {
  invoiceId String
  invoice   Invoice @relation(fields: [invoiceId], references: [id])
  tripId    String
  trip      Trip    @relation(fields: [tripId], references: [id])

  @@id([invoiceId, tripId])
}

model CompanyInfo {
  id          Int      @id @default(1)   // singleton
  name        String?
  legalName   String?
  street1     String?
  zipCode     String?
  city        String?
  countryCode String?
  vatNbr      String?
  email       String?
  website     String?
  ownerSurname String?
  ownerName   String?
  mobile      String?
  ownerEmail  String?
  saved       Boolean  @default(false)
}

model FxRateCache {
  currency   String   @id
  eurPerUnit Decimal
  fetchedAt  DateTime
}

model RefCounter {
  scope     String @id     // ex: "trip:C00001:26", "invoice", "client:individual"
  lastValue Int    @default(0)
}
```

### Points d'attention explicites

- **Facturation légale (phase 2, pas maintenant)** : `vatRate` est déjà un champ réel (pas codé en dur) pour préparer la conformité TVA/numérotation légale future — mais la logique de conformité complète (mentions obligatoires, séquence légale inviolable, export comptable) reste **hors scope v1**, à traiter explicitement en phase 2 quand la facturation deviendra réelle (l'utilisateur a insisté pour que ce point ne soit pas oublié).
- **WhatsApp** : `NotificationsModule` expose une interface `WhatsAppProvider.send(to, template, vars)` ; `TwilioWhatsAppProvider` est la seule implémentation en v1, mais le contrat permet un `Dialog360WhatsAppProvider` ou `MetaCloudWhatsAppProvider` sans toucher au reste du code (décision explicite : garder Twilio, mais bien encapsulé).
- **Auth** : mot de passe hashé (argon2/bcrypt), 2FA par email (code à 6 chiffres, table `OtpCode`) pour **tous** les utilisateurs, session en cookie `httpOnly + Secure + SameSite=Lax` (corrige l'absence de `Secure` du legacy). Rôles : `ADMIN` (= admin/god) et `DISPATCHER`.
- **`RefCounter`** corrige le bug de remise à zéro des séquences au redémarrage (legacy = `Map` en mémoire).
- **`TripStep`** remplace l'objet JSON `steps` du legacy par une vraie table d'historique auditable (une ligne par étape franchie, horodatée).

---

## Journal

> **2026-08-26 — Version initiale.** Issue de la session de cadrage (grilling) : mono-tenant, solo dev + Claude Code, priorité robustesse dès la v1, NestJS+Prisma+Postgres, Twilio encapsulé derrière une interface remplaçable (`WhatsAppProvider`), 2FA email pour tous les utilisateurs, rôles ADMIN/DISPATCHER. Facturation légale explicitement reportée à une phase 2 future. Modèles Prisma initiaux dérivés entité par entité de l'inventaire `LEGACY_FEATURES.md`.
