# Mise en ligne de Cockpit sur un VPS (OVH)

Ce dossier contient tout pour faire tourner Cockpit sur **un seul serveur** :
HTTPS automatique (Caddy), l'interface web, l'API, Postgres et MinIO, avec une
sauvegarde chaque nuit. Les images sont **construites sur le serveur** à partir
du code récupéré depuis GitHub : ce qui tourne est exactement le commit tiré.

> Ce guide **remplace** le workflow `deploy.yml` (Docker Hub) tant qu'on déploie
> à la main depuis le serveur. Ne pas lancer les deux.

Serveur : `92.222.180.234` (utilisateur `ubuntu`) — domaine : `cockpit.gt-ops.club`.

## 1. DNS (chez IONOS)

Ajouter **une seule** entrée, sans toucher aux autres (surtout MX/TXT/CNAME des emails) :

| Type | Nom d'hôte | Valeur |
|---|---|---|
| A | `cockpit` | `92.222.180.234` |

Vérifier : `ping cockpit.gt-ops.club` doit répondre avec cette IP.

## 2. Se connecter et préparer le serveur (une seule fois)

Depuis le Terminal du Mac : `ssh ubuntu@92.222.180.234` (le mot de passe ou la clé
viennent d'OVH ; ne les partagez avec personne).

```bash
sudo apt update && sudo apt upgrade -y

# Pare-feu : SSH + web uniquement
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw --force enable

# 2 Go de swap (le build des images est gourmand pour 4 Go de RAM)
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
```

Se déconnecter puis se reconnecter (`exit`, puis `ssh ...`) pour que le groupe `docker` soit pris en compte.
Si le script Docker refuse cette version d'Ubuntu : `sudo apt install -y docker.io docker-compose-v2`.

## 3. Récupérer le code (dépôt privé)

Une clé en **lecture seule**, propre à ce serveur :

```bash
ssh-keygen -t ed25519 -f ~/.ssh/cockpit_deploy -N ""
cat ~/.ssh/cockpit_deploy.pub
```

Sur GitHub : dépôt `GT-OpsCockpit/Cockpit` → Settings → Deploy keys → Add deploy key,
coller la ligne affichée, **sans** cocher « Allow write access ».

```bash
printf 'Host github.com\n  IdentityFile ~/.ssh/cockpit_deploy\n  IdentitiesOnly yes\n' >> ~/.ssh/config
ssh -T git@github.com            # répondre "yes" ; "successfully authenticated" = OK
git clone git@github.com:GT-OpsCockpit/Cockpit.git ~/cockpit
cd ~/cockpit
git checkout <nom-de-la-branche-poussée>   # tant que ce n'est pas fusionné dans main
```

## 4. Configuration (secrets)

```bash
cd ~/cockpit/deploy
cp .env.example .env
nano .env
```

Remplir chaque ligne. Mots de passe et secrets aléatoires : `openssl rand -hex 24`
(et `openssl rand -hex 32` pour `PARTNER_LINK_SECRET`). Les valeurs SMTP/Twilio sont
celles de votre `apps/api/.env` local. Le fichier `.env` reste sur le serveur, jamais dans git.

## 5. Premier démarrage

```bash
cd ~/cockpit/deploy
./update.sh                                              # build + migrations + démarrage
docker compose -f docker-compose.prod.yml run --rm seed  # administrateur, pays, types de véhicules (sans données de démo)
```

Ouvrir `https://cockpit.gt-ops.club` et se connecter avec `ADMIN_EMAIL` (le code arrive par email).
Le premier certificat HTTPS peut prendre une minute.

## 6. Sauvegardes (chaque nuit, 14 jours conservés)

```bash
mkdir -p ~/backups && ./backup.sh && ls -lh ~/backups      # test manuel
crontab -e   # ajouter la ligne :
# 30 3 * * * /home/ubuntu/cockpit/deploy/backup.sh
```

Chaque sauvegarde contient la base (`db-….sql.gz`) et les fichiers téléversés (`files-….tar.gz`).
En cas d'échec, une ligne est écrite dans `~/backups/backup.log` et, si `BACKUP_ALERT_EMAIL` est rempli, un email part.

**Copie sur le Mac** (une sauvegarde qui reste sur le serveur ne protège pas d'une perte du serveur) :

```bash
rsync -av ubuntu@92.222.180.234:backups/ ~/CockpitBackups/
```

**Restaurer la base** (teste-le une fois pour de vrai) :

```bash
cd ~/cockpit/deploy
gunzip -c ~/backups/db-AAAA-MM-JJ_HHMM.sql.gz | docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U cockpit -d cockpit
```

(sur une base vide : `docker compose -f docker-compose.prod.yml down`, supprimer le volume `cockpit_postgres_data`, relancer `./update.sh`, puis restaurer.)

## 7. Mettre à jour plus tard

Après chaque fusion sur GitHub : `ssh ubuntu@92.222.180.234`, puis

```bash
cd ~/cockpit/deploy && ./update.sh            # ou ./update.sh <autre-branche>
```

Le script fait d'abord une sauvegarde, puis reconstruit, applique les migrations et redémarre.

## Utile

```bash
docker compose -f docker-compose.prod.yml ps           # état des services
docker compose -f docker-compose.prod.yml logs -f api  # journaux de l'API
```

## Points d'attention

- `PARTNER_LINK_SECRET` : ne jamais le changer une fois des liens envoyés aux partenaires.
- Seuls les ports 22, 80 et 443 sont ouverts ; Postgres et MinIO ne sont pas accessibles depuis Internet.
- La sauvegarde automatique d'OVH (quotidienne, incluse) s'ajoute à celle-ci mais ne la remplace pas.
- La base de production démarre **vide** (baseline seulement). Pour y reprendre les données du Mac,
  faire un `pg_dump` local et le restaurer comme ci-dessus, avant d'ouvrir l'accès aux utilisateurs.
