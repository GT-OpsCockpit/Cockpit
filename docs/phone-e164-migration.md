# Passage des téléphones à l'E.164

## Pourquoi

Jusqu'ici `normalizePhone` ne gardait que les chiffres — **le `+` compris**. Deux formats
incompatibles cohabitaient donc dans les mêmes colonnes :

| Stocké | Signifie | Problème |
|---|---|---|
| `0612345678` | numéro national français | indécidable sans connaître le pays |
| `33612345678` | indicatif sans son `+` | indiscernable du précédent par une machine |

Conséquence directe : `TwilioWhatsAppProvider` construisait `whatsapp:+${chiffres}`, soit
`whatsapp:+0612345678` — rejeté par Twilio. **Tout numéro saisi sans indicatif était
silencieusement injoignable.**

Depuis, tout est stocké en E.164 (`+33612345678`) : un seul format, auto-descriptif, celui que
Twilio compose. Le format est imposé côté formulaire (`<PhoneInput>` n'émet que de l'E.164) et
côté API (`@IsPhone`), les deux via `isValidPhone` de `@cockpit/shared`.

## Reprise des données existantes

Le schéma ne change pas (l'E.164 tient dans les colonnes `TEXT` existantes) : il n'y a donc pas de
migration Prisma, seulement un script — le parsing exige libphonenumber, que du SQL ne peut pas
appeler.

```bash
# 1. À blanc d'abord : n'écrit rien, produit le rapport complet.
pnpm --filter @cockpit/api backfill:phones -- --dry-run

# 2. Lire backfill-phones-report.json (voir « Lire le rapport » ci-dessous).

# 3. Pour de vrai.
pnpm --filter @cockpit/api backfill:phones
```

Tout se déroule dans **une seule transaction** : l'index unique `Driver_phone_key` est supprimé, les
lignes sont réécrites, l'index est recréé. En cas d'erreur, rien n'est écrit.

### Comment chaque valeur est relue

Dans cet ordre, celui qui ne peut pas perdre d'information :

1. la valeur commence par `+` → elle fait foi ;
2. sinon, on tente de lui rendre son `+` (`33612345678` → `+33612345678`) ;
3. sinon seulement, on l'interprète comme un numéro national, sous le pays de la ligne
   (`Driver.countryCode`) ou, à défaut, sous `BACKFILL_PHONE_COUNTRY` (défaut `FR`).

L'étape 2 passe avant l'étape 3 délibérément : lire `33612345678` comme un numéro national français
donnerait un mauvais numéro au lieu du bon.

Seul `Driver` porte un pays décrivant la personne. `Client.pocPhone`, `Trip.pocPhone`, `User.phone`
et `CompanyInfo.mobile` n'en ont aucun de fiable — le pays d'un POC n'est pas celui de la
réservation — donc leurs numéros nationaux passent tous par l'hypothèse de l'étape 3, et **chaque
ligne concernée est listée dans le rapport** (`via: "assumed:FR"`).

### Lire le rapport

`backfill-phones-report.json`, écrit à chaque exécution :

- `converted` — chaque valeur avant/après, avec `via` (`international`, `plus-restored`,
  `assumed:XX`). Relire en priorité les `assumed:*`, ce sont les seules devinettes.
- `blanked` — les `''` devenus `NULL`. `Client.pocPhone` écrivait `''` là où `Driver.phone`
  écrivait `NULL` ; les deux disent maintenant `NULL`, ce que l'index unique exige et ce que SQL
  entend par « inconnu ».
- `skipped` — **laissées telles quelles**, jamais supprimées : un numéro illisible reste la seule
  trace de comment joindre quelqu'un. À ressaisir à la main.
- `merged` — voir ci-dessous.

### Collisions de chauffeurs

`Driver.phone` est un index unique **et** une clé d'identité : `POST /api/drivers` renvoie le
chauffeur existant quand le téléphone correspond. Or `0612345678` et `33612345678` se normalisent
tous deux en `+33612345678` — deux fiches peuvent donc se retrouver sur le même numéro.

Dans ce cas le script **s'arrête** en listant les `ref` concernés et n'écrit rien. Fusionner deux
chauffeurs est une décision métier, pas une étape de migration. Après arbitrage :

```bash
# Garde le chauffeur le plus ancien sur chaque numéro, met le téléphone des autres à NULL.
pnpm --filter @cockpit/api backfill:phones -- --merge-duplicates
```

Le `--dry-run` détecte les collisions à partir des valeurs *prévues*, pas de ce qu'il y a en base —
sans quoi une exécution à blanc, qui n'écrit rien, ne les verrait jamais.
