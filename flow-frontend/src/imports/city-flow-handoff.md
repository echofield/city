 City Flow — Design Handoff

  Context

  Intelligence portal pour chauffeurs VTC Paris. L'interface doit sentir comme un instrument de cockpit, pas une app
  consumer. Inspiration: terminal de trading, radar aviation, télémétrie F1.

  ---
  Page 1: Dashboard (existant, validé ✓)

  Structure actuelle qui fonctionne:
  - Header sticky avec statut "Champ confirmé" + confiance %
  - Arc temporel (progression du shift)
  - Carte Paris (nouvelle, à raffiner)
  - Navigation: Maintenant / Prochain / Ce soir / Complet

  ---
  Features à designer

  1. Carte Paris (Champ Spatial)

  - Fond très sombre, frontières arrondissements subtiles
  - Zones = cercles avec glow selon intensité
  - Couleurs par phase:
    - Vert = actif/pic (fenêtre ouverte)
    - Ambre/or = en formation
    - Gris = calme/dormant
  - Seine visible mais discrète
  - Labels zones apparaissent au hover ou si intensité > 30%
  - Respiration subtile (pulse lent) = volatilité du marché

  2. Vue "Maintenant" (Flow Active)

  - État du champ: "Fenêtre active" / "En formation" / "Maintenir position"
  - Countdown proéminent (temps restant sur la fenêtre)
  - Zone cible en grand
  - Bouton navigation (Waze)
  - Alternatives si saturé
  - Signaux contextuels (tags: "Sortie concert", "Pluie +20min")

  3. Vue "Prochain"

  - Transition clé attendue (texte court)
  - Timeline slots: heure | zone | saturation
  - Tap = ouvre navigation

  4. Vue "Ce soir" (Horizon)

  - Pics attendus (badges)
  - Hotspots avec score + fenêtre horaire
  - Règles du jour (si X alors Y)

  5. Shift Arc (barre temporelle)

  - Phases: Calme → Montée → Pic → Dispersion
  - Position actuelle marquée
  - Compact, horizontal, toujours visible

  ---
  Principes visuels

  - Palette: Noir profond (#0a0a0b), vert signal (#00B14F), or intent (#C9A24A), texte off-white
  - Typo: Monospace pour données, sans-serif pour labels
  - Animations: Uniquement si elles encodent de l'info (pas décoratif)
  - Mobile-first: Usage en voiture, une main, glances rapides
  - Pas d'emoji, pas de ton "assistant IA"
  - Inspiration: Bloomberg terminal meets aviation HUD

  ---
  Ce qu'on ne veut PAS

  - Look "app Uber/Bolt" (trop consumer)
  - Chatbot vibes
  - Explications longues
  - Couleurs vives saturées
  - Animations gratuites

  ---
  Livrables attendus

  - Dashboard desktop + mobile
  - États des zones (dormant, forming, active, peak, fading)
  - Composants: carte, shift arc, cards, boutons, badges saturation
  - Dark mode only (pas de light mode prévu)

  ---
  Marge créative bienvenue sur: disposition des éléments, micro-interactions, iconographie, densité d'information.