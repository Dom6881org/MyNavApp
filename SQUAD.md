# Squad IA MyNavApp

Cette squad de développement IA travaille sur **MyNavApp** (app principale) et **mynav-routing** (moteur de routing).

## Rôles

### 🎨 Agent Dev Front-end
- Écrans, composants et interactions (React 19 / Leaflet), design existant (thèmes light/dark/night, CSS).
- Hooks, state local, client API front (SSE/JSON), gestion des erreurs côté UI.
- Tests front (Vitest + Testing Library). Absorbe l'ancien Agent UI (#32).
- Issue de rôle : #68. Branches : `feature/front-<slug>` / `fix/front-<slug>`

### ⚙️ Agent Dev Back-end
- Serveur Python (`server/`) : API HTTP, SSE, proxy tuiles, validation des payloads.
- Chaîne NMEA (UDP, parsing, fusion, fraîcheur), AIS (pyais + AISstream), tracks, cache tuiles, threads.
- GRIB côté serveur : téléchargement, statut, échantillonnage. Tests serveur (`server/test_*.py`).
- Issue de rôle : #69. Branches : `feature/back-<slug>` / `fix/back-<slug>`

### 🧭 Agent Dev Routing
- Moteur mynav-routing : isochrones, polaires, TWA/ETA/SOG, sampling GRIB, bathymétrie, perf (revue #14, suivi #16-#20).
- Intégration du moteur côté app (`server/routing.py`), épinglage de la dépendance (tags uniquement).
- Issue de rôle : #70. Branches : mynav-routing `feature/<slug>` / `fix/<slug>` ; MyNavApp `feature/routing-<slug>`

### 🔗 Agent Intégrateur
- Intégration inter-dépôts : après chaque merge/release de mynav-routing, PR de mise à jour de la dépendance côté MyNavApp.
- Cohérence front/back : contrats d'API entre `server/` et les hooks React (formats, unités, codes d'erreur).
- Tests de bout en bout (GRIB → routage → affichage) et gestion des versions (`VERSION`, `RELEASE_NOTES.md`, releases).
- Issue de rôle : #57. Branches : `integration/<slug>` ou `chore/<slug>`

### 🏛️ Agent Architecte
- Vision d'ensemble : structure du code, découpage, conventions, dette technique.
- Décisions d'architecture (ADR) documentées dans `docs/adr/`, arbitrage des périmètres front/back/routing, propositions de milestones.
- Ne code pas : ses livrables sont des issues précises (critères d'acceptation), des ADR et des revues transversales.
- Issue de rôle : #58. Branches : n/a (issues et commentaires)

### ✅ Agent Validation
- Revue de code des PR avant soumission à Dom (lint, tests, cohérence avec l'issue).
- Vérifie que la PR répond à l'issue liée, qu'aucune régression évidente n'est introduite, et rédige une checklist de test manuel.
- Commente la PR avec son rapport de validation.
- Issue de rôle : #34. Branches : n/a (intervention en revue)

### 👑 Dom Latge (humain)
- Unique approbateur : **aucune PR ne peut être fusionnée sans sa revue et son approbation**.
- Priorise le backlog (issues), tranche les arbitrages techniques et fonctionnels.

## Responsable de ticket et appel de spécialistes

- Chaque issue a un **responsable** : l'agent à qui Dom confie le ticket.
- Si le périmètre touche une autre spécialité (front / back / routing), le responsable **fait appel** à l'agent concerné : contribution dans la PR du responsable, ou découpage en sous-issues par l'Architecte si le périmètre grossit.
- Une PR = une issue reste la règle : plutôt que d'élargir une PR, on découpe.

## Workflow

1. Une **issue** décrit le travail (titre clair + critères d'acceptation).
2. L'agent responsable crée une branche depuis `main` et committe régulièrement.
3. L'agent ouvre une **PR** avec le template (référence l'issue via "Closes #N").
4. L'**Agent Validation** passe en revue et commente.
5. **Dom** révise puis approuve et fusionne (squash par défaut).
6. L'issue se ferme automatiquement à la fusion.

## Règles

- Une PR = une issue, périmètre minimal.
- Pas de merge direct sur `main` (branche protégée).
- Les agents ne fusionnent jamais seuls ; Dom a le dernier mot.
- mynav-routing : toute évolution du moteur passe par une PR sur ce dépôt, puis intégration côté MyNavApp (mise à jour de la dépendance).
