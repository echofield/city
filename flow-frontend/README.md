# FLOW

Intelligence temporelle pour chauffeurs VTC Paris.

Un instrument, pas un dashboard. Le chauffeur lit la ville comme la meteo.


## Stack

| Couche       | Technologie                          |
|-------------|--------------------------------------|
| Framework   | React 18 + TypeScript                |
| Build       | Vite 6                               |
| CSS         | Tailwind CSS v4                      |
| Animation   | Motion (ex Framer Motion)            |
| Routing     | React Router 7                       |
| Typo        | Inter, JetBrains Mono, Cormorant Garamond (Google Fonts) |


## Prerequis

- **Node.js** >= 18
- **pnpm** (recommande) ou npm ou yarn

```bash
# Installer pnpm si besoin
npm install -g pnpm
```


## Installation

```bash
# 1. Dezipper le projet
unzip flow.zip
cd flow

# 2. Installer les dependances
pnpm install

# 3. Lancer en dev
pnpm dev

# 4. Ouvrir dans le navigateur
# http://localhost:5173
```

Pas de cle API. Pas de backend. Pas de base de donnees.
Tout tourne en local, tout de suite.


## Build production

```bash
pnpm build
```

Le build sort dans `dist/`. Deployable sur Vercel, Netlify, Cloudflare Pages, ou n'importe quel hebergement statique.


## Structure du projet

```
src/
  app/
    App.tsx                   -- Point d'entree (RouterProvider)
    routes.ts                 -- 3 routes: / /flow /replay
    components/
      Onboarding.tsx          -- Onboarding reactif en 3 etapes
      Dashboard.tsx           -- Instrument principal (4 onglets)
      Replay.tsx              -- Revue de shift (boucle memoire)
      FlowEngine.ts           -- Moteur temporel (simulation)
      FlowMap.tsx              -- Carte SVG Paris (22 territoires)
      parisData.ts            -- Donnees cartographiques
      theme.ts                -- Couleurs et tokens typographiques
      ui/                     -- Composants Shadcn (disponibles)
  styles/
    fonts.css                 -- Import Google Fonts
    index.css                 -- Point d'entree CSS
    tailwind.css              -- Config Tailwind v4
    theme.css                 -- Tokens CSS du theme
```


## Navigation

| Route      | Ecran            | Description                                         |
|-----------|------------------|-----------------------------------------------------|
| `/`       | Onboarding       | 3 etapes: Quand, Ou, Comment. La carte reagit en direct. |
| `/flow`   | Dashboard        | L'instrument. 4 onglets: Maintenant, Prochain, Ce soir, Complet. |
| `/replay` | Revue de shift   | Fenetres capturees/manquees, alignement, meilleure zone. |


## Grammaire de couleurs

| Couleur         | Code      | Signification                  |
|----------------|-----------|--------------------------------|
| Vert `#00B14F` | `C.green` | Actif / Go / Argent            |
| Ambre `#C9A24A`| `C.amber` | En formation / Attention       |
| Gris `#4a4a50` | `C.gray`  | Dormant / Inactif              |
| Rouge `#a04040`| `C.red`   | Sature / Eviter                |


## Typographie

| Police             | Usage                              |
|-------------------|------------------------------------|
| Cormorant Garamond | Mots d'action (DEPLACER, MAINTENIR) |
| JetBrains Mono     | Donnees (countdown, EUR/h, heures)  |
| Inter              | Labels, navigation, texte courant   |


## Donnees

Actuellement le moteur tourne sur des **donnees simulees** (`FlowEngine.ts`).
Les zones, la saturation, les signaux contextuels et les fenetres temporelles
sont generes a partir de l'heure reelle et de patterns temporels.

Pour passer en donnees reelles :
- Remplacer `computeFlowState()` par un appel API (Supabase, REST, WebSocket)
- Le contrat d'interface `FlowState` reste le meme
- Aucun changement cote UI necessaire


## Deploiement Vercel (le plus simple)

```bash
# 1. Installer Vercel CLI
npm install -g vercel

# 2. Deployer
vercel

# 3. C'est en ligne
```

Pas de configuration necessaire. Vite + React est detecte automatiquement.


## Prochaines etapes

- Deep-link NAVIGUER vers Waze (coordonnees GPS des zones)
- Branchement donnees reelles via Supabase ou API temps reel
- Persistance session pour que le Replay montre les vrais shifts
- PWA manifest pour usage mobile plein ecran
- Notifications push pour les pics detectes


## Philosophie

> "Un chauffeur experimente qui murmure le timing."

Pas de metriques superflues. Pas de dashboards. Pas d'IA verbeuse.
Un etat. Un countdown. Une action. Le champ parle, le chauffeur synchronise.
