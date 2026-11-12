# KuribOhrganizer

Suivi de collection Yu-Gi-Oh! : archétypes, cartes possédées et voulues, archétypes perso, classeurs virtuels de 9 cases et chasse aux faux. En ligne sur https://yugioh.miroirdesreves.com.

- `backend/` : API NestJS + MongoDB. Elle copie la base de cartes ygoprodeck dans Mongo (synchro la nuit, seulement si leur version a changé), met en cache les images sur le disque et gère les comptes. Elle sert aussi le front compilé.
- `frontend/` : Angular 21 + Tailwind, pensé pour le téléphone d'abord.

## Développement

```bash
npm run install:all
cp backend/.env.example backend/.env      # puis le compléter
npm --prefix backend run dev              # API sur http://localhost:4441, base yugioh_dev
npm --prefix frontend start               # front sur http://localhost:4200, /api relayé vers le backend
```

La prod (pm2, port 4440, base yugioh) peut tourner en même temps. Au premier démarrage le backend télécharge toute la base de cartes (quelques secondes). Les images arrivent dans `data/images/` au fil des affichages.

## Production

Le backend tourne sous pm2 (`ecosystem.config.js`, port 4440 en local) et Caddy relaie `yugioh.miroirdesreves.com` vers lui.

```bash
npm run deploy      # compile front + back, (re)lance le process pm2 "yugioh"
npm run logs
```

Configuration Caddy :

```caddy
yugioh.miroirdesreves.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:4440
}
```

## Comptes

Inscription ouverte avec pseudo + mot de passe, et connexion Google / Discord si leurs identifiants sont renseignés dans `backend/.env` (voir `backend/.env.example`). Il n'y a pas d'email : un mot de passe oublié se réinitialise depuis le serveur.

```bash
# MONGO_URI : sans lui, les scripts visent la base de dev (yugioh_dev)
cd backend && MONGO_URI=mongodb://127.0.0.1:27017/yugioh npm run set-password -- <pseudo> <nouveau mot de passe>
```

Un compte admin peut créer des **archétypes du site**, communs à tous : ils regroupent des archétypes officiels (qui disparaissent alors de la liste de tout le monde) et des cartes ajoutées une à une. Les nouvelles cartes des archétypes regroupés y arrivent toutes seules à chaque synchro. Depuis l'appli : case « Pour tout le monde » à la création, ou bouton « Publier pour tous » sur un archétype perso.

```bash
cd backend && MONGO_URI=mongodb://127.0.0.1:27017/yugioh npm run set-admin -- <pseudo>        # "off" en plus pour retirer le rôle
```

Les données de l'ancien site (classeurs et tri des faux restés dans le navigateur, fichiers `YGOToolsProfile.json` et `YGOToolsBinders.json`) s'importent depuis l'appli une fois connecté.
