# CITY-FLOW — Brief pour Figma AI

> App mobile pour chauffeurs VTC Paris.
> Objectif: savoir ou aller en 2 secondes.

---

## IDENTITE

**Ton:** Pro, sobre, operationnel. Pas startup, pas gaming.
**Reference visuelle:** Terminal Bloomberg, cockpit aviation, outil pro.
**Langue:** Francais. Mots courts. Zero jargon tech.

---

## ONBOARDING (3 ecrans)

### Ecran 1 — Promesse
**Titre:** "Sais ou aller. Avant les autres."
**Sous-titre:** Une phrase max sur le positionnement intelligent.
**Action:** Bouton continuer

### Ecran 2 — Localisation
**Titre:** "Ta position, tes recommandations"
**Explication:** Une phrase sur pourquoi la localisation aide.
**Actions:**
- Autoriser (principal)
- Plus tard (secondaire, discret)

### Ecran 3 — Mode
**Titre:** "Comment utiliser Flow?"
**Choix:**
- Demo — donnees simulees, gratuit
- Live — donnees reelles, abonnement
**Action:** Commencer

---

## VUE PRINCIPALE — GUIDE

C'est l'ecran principal. Le chauffeur passe 90% de son temps ici.

### Structure

```
HEADER
- Indicateur mode (Guide/Dispatch)
- Phase actuelle (Calme/Montee/Pic/Dispersion)

CARTE (gauche ou haut sur mobile)
- Paris avec arrondissements
- Zone recommandee mise en evidence
- Point "toi ici" si localisation active

PANNEAU ACTION (droite ou bas)
- Divisé en 3 blocs
```

### Bloc 1 — ACTION (le plus grand, le plus visible)

**Contenu:**
- Nom de zone (ex: "BERCY")
- Arrondissement (ex: "XII")
- Distance + temps (ex: "5 km — 12 min")
- Fenetre optimale (ex: "22:35–23:10")
- Entree conseillee (ex: "cote Nation")
- 3 indicateurs chiffres:
  - Opportunite (0-100)
  - Friction (0-100)
  - Cout repositionnement (0-100)
- Message contextuel si pertinent (ex: "Tu es deja dans le bon corridor")

**Intention:** Le chauffeur sait immediatement OU aller et si ca vaut le coup.

### Bloc 2 — FRICTION (plus petit)

**Contenu:**
- Type de friction (ex: "RER A perturbe")
- Implication (ex: "Bonus VTC banlieue Est")

**Intention:** Une alerte, pas une liste. Un seul element.

### Bloc 3 — ALTERNATIVE (plus petit)

**Contenu:**
- Zone alternative (ex: "Gare de Lyon")
- Distance + temps (ex: "3 km — 8 min")
- Condition (ex: "si saturation Bercy")

**Intention:** Plan B en un coup d'oeil.

### Barre Timeline (bas)

**Contenu:**
```
CALME — MONTEE — PIC — DISPERSION
```
Avec indicateur de position actuelle.

**Intention:** Ou on en est dans la soiree.

---

## VUE DISPATCH — Strategie

Accessible depuis le header. Vue complementaire, pas concurrente.

### Structure

```
HEADER
- Meme que Guide

SESSION
- Duree active (ex: "2h 34min")
- Gains vs objectif (ex: "72€ / 120€")
- Barre de progression
- Efficacite (ex: "71%")

CORRIDORS
- 4 directions: Nord, Est, Sud, Ouest
- Etat chacun: fluide / dense / sature
- Raison si pertinent (ex: "sortie concert")

TIMELINE +2H
- 3 evenements max
- Heure + type + zone
- Ex: "23:00 — pic — Bercy"
```

**Intention:** Vision strategique. Pas d'action immediate mais contexte pour decider.

---

## TEMPLATES JOUR (optionnel, pre-session)

Avant de commencer sa session, le chauffeur peut voir la journee.

### Structure

4 blocs pour 4 moments:
- MATIN
- MIDI
- SOIR
- NUIT

**Chaque bloc contient:**
- Titre descriptif (ex: "Stade/Arena")
- Fourchette gains (ex: "~20-35€")
- Niveau stress (1-3)
- Zones suggerees (ex: "Bercy, Accor Arena")
- Raisons si jour special (ex: "Concert Phoenix 22h45")

**Intention:** Planifier sa soiree avant de demarrer.

---

## ELEMENTS RECURRENTS

### Indicateurs chiffres (OPP / FRIC / COST)

3 petits badges avec:
- Label court (3-4 lettres)
- Valeur (0-100)
- Couleur selon valeur (vert/jaune/rouge)

Logique couleur:
- OPP: haut = vert, bas = rouge
- FRIC: bas = vert, haut = rouge
- COST: bas = vert, haut = rouge

### Zone sur la carte

- Zone recommandee: mise en evidence forte
- Zones actives: mise en evidence moyenne
- Zones froides: neutres
- Position chauffeur: marqueur distinct

### Messages contextuels

Courts. Une ligne max.
Ex:
- "Tu es dans le corridor EST. Opportunite naturelle."
- "Repositionnement couteux. Reste en zone."
- "Fenetre active. Bouge maintenant."

---

## CE QUI N'EST PAS DANS L'APP

- Pas de chat
- Pas de feed social
- Pas de notifications push excessives
- Pas de gamification (badges, scores, classements)
- Pas de publicite
- Pas de map interactive complexe (zoom/layers/filters)
- Pas d'historique detaille des courses
- Pas de parametres avances

---

## MOTS A UTILISER

**Oui:**
- Zone
- Corridor
- Fenetre
- Opportunite
- Friction
- Pic
- Dispersion
- Actif
- Fluide / Dense / Sature

**Non:**
- Dashboard
- Analytics
- Insights
- Smart / IA / Intelligence
- Monetisation
- Premium
- Boost

---

## HIERARCHIE VISUELLE

```
1. Zone recommandee (GROS, CLAIR)
2. Distance/temps (visible immediatement)
3. Indicateurs (OPP/FRIC/COST)
4. Contexte (fenetre, entree, message)
5. Friction (alerte secondaire)
6. Alternative (plan B)
7. Timeline (orientation temporelle)
```

---

## INTERACTIONS PRINCIPALES

1. **Ouvrir app** → Vue Guide avec recommandation
2. **Taper sur zone carte** → Highlight + infos distance
3. **Taper sur Dispatch** → Vue strategique
4. **Tirer vers le bas** → Rafraichir donnees
5. **Taper sur template jour** → Voir details moment

---

## ETATS SPECIAUX

### Pas de localisation
- Masquer distances/temps
- Afficher message discret "Localisation desactivee"
- Garder recommandations zones

### Pas de donnees
- Message "Journee calme" ou "Pas de signal"
- Suggerer de revenir plus tard

### Erreur connexion
- Afficher dernieres donnees
- Indicateur "Donnees de [heure]"
- Bouton reessayer

### Mode demo
- Bandeau discret "Simulation"
- Memes fonctionnalites que live

---

## RESUME EN UNE PHRASE

> Un ecran principal avec UNE zone recommandee, SA distance, et TROIS indicateurs de decision.
> Le reste est contexte.
