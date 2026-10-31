# MyNavApp v1.1.0 — Routage météo complet

## Nouveautés
- **Routage de voilier complet** : intégration du moteur [mynav-routing v0.3.3](https://github.com/Dom6881org/mynav-routing/releases/tag/v0.3.3) — isochrones, grande vitesse polaire, courants (issue #14)
- **GRIB offline-first** (issue #16) : champ de vent GRIB2 téléchargé à terre via Open-Météo, mis en cache avec validité, lecture par ecCodes ; dégradation propre en vent constant si absent/expiré
- **Options A + B de l'issue #36** : échantillonnage des barbes de vent depuis le GRIB (≈100× moins de requêtes Open-Météo), combiné avec le TTL cache de 60 min
- **Densité des barbes** (issue #21)
- **ecCodes par pip uniquement** (issue #42) : pin `eccodes>=2.43` (la roue embarque la librairie native), fin de l'installation manuelle conda/DLL Windows, `selfcheck` dans le CI

## Technique
- `server/grib.py`, `server/routing.py`, `requirements-routing.txt`
- CI : Node 22, `test:front`, selfcheck ecCodes

## Issues fermées
#14, #16, #21, #36, #42
