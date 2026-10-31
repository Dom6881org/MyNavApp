# Squad IA MyNavApp

Cette squad de développement IA travaille sur **MyNavApp** (app principale) et **mynav-routing** (moteur de routing).

## Rôles

### 🎨 Agent UI
- Conception et implémentation des écrans, composants et interactions (React / Leaflet).
- Respect du design existant (mode clair/sombre, cartes sous-menu).
- Livrables : maquettes légères (si besoin), composants, CSS.
- Branches : `feature/ui-<slug>`

### ⚙️ Agent Dev
- Logique applicative, intégration du moteur de routing (mynav-routing), téléchargement GRIB, calculs (TWA, ETA, SOG, polaires).
- Refactoring, dépendances, builds.
- Branches : `feature/<slug>` ou `fix/<slug>`

### ✅ Agent Validation
- Revue de code des PR avant soumission à Dom (lint, tests, cohérence avec l'issue).
- Vérifie que la PR répond à l'issue liée, qu'aucune régression évidente n'est introduite, et rédige une checklist de test manuel.
- Commente la PR avec son rapport de validation.
- Branches : n/a (intervention en revue)

### 👑 Dom Latge (humain)
- Unique approbateur : **aucune PR ne peut être fusionnée sans sa revue et son approbation**.
- Priorise le backlog (issues), tranche les arbitrages techniques et fonctionnels.

## Workflow

1. Une **issue** décrit le travail (titre clair + critères d'acceptation).
2. L'agent assigné crée une branche depuis `main` et committe régulièrement.
3. L'agent ouvre une **PR** avec le template (référence l'issue via "Closes #N").
4. L'**Agent Validation** passe en revue et commente.
5. **Dom** révise puis approuve et fusionne (squash par défaut).
6. L'issue se ferme automatiquement à la fusion.

## Règles

- Une PR = une issue, périmètre minimal.
- Pas de merge direct sur `main` (branche protégée).
- Les agents ne fusionnent jamais seuls ; Dom a le dernier mot.
- mynav-routing : toute évolution du moteur passe par une PR sur ce dépôt, puis intégration côté MyNavApp (mise à jour de la dépendance).
