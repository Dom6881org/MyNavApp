# ADR-0004 — Autorité du vent de routage côté serveur

**Statut** : Accepté — en production depuis le 03/11/2026 (issues #102/#103, PR #104 back + #105 front, revue architecture #88 dette D2, chantier C2).

## Contexte

Trois pipelines de vent coexistent dans l'app : les instruments NMEA (SSE), la prévision du point (Open-Météo/GRIB) et la grille de barbes. Le payload de routage transportait en outre le **vent affiché par le front** (`navigationData.wind`) en prétendu « repli » — que le serveur n'utilisait **que** faute de GRIB frais, avec un vent de test (270°/12 kt) par défaut si le champ manquait.

Confusion constatée le 02/11 : personne (agent ou humain) ne savait dire quel vent servait réellement au calcul. Risque silencieux : un **ETA calculé sur un vent différent de celui affiché**, sans erreur visible.

## Décision

1. **Le serveur est l'autorité unique du vent de routage.** `apply_server_wind_authority()` retire le champ `wind` du payload client aux **deux** points d'entrée (`POST /api/routing/compute` et `/api/routing/jobs`) puis, si disponible, injecte son propre repli.
2. **Repli constant strict** : uniquement si le flux NMEA est frais (≤ 5 s), avec vent vrai (MWV-T) **et** cap (HDT/HDG) — `directionFromDeg = (cap + angle) % 360`. Sinon : **refus clair** (`RoutingError` « Aucun vent disponible… »). Plus aucun vent inventé (suppression du 270°/12 par défaut).
3. **Le GRIB frais reste prioritaire** ; `windSource` dans la réponse fait foi ; l'echo `wind` est `null` quand le GRIB sert au calcul.
4. **Conversion apparent→vrai exclue** : elle exigerait SOG et vecteur bateau ; approximation rejetée — mieux vaut un échec explicite qu'un ETA faux.

## Conséquences

✅ Le front n'envoie que le plan (`start`, `finish`, `polarId`) ; erreurs actionnables (« téléchargez un GRIB ou connectez les instruments ») ; un seul endroit à faire évoluer pour le vent de routage ; les nouveaux chantiers vent n'héritent plus de l'ambiguïté.

⚠️ Divulgué : sans girouette MWV-T **ou** sans compas, le repli constant est indisponible (refus) — c'est voulu. Le vent affiché par les instruments (WIND) et la grille de barbes restent des pipelines d'**affichage**, indépendants du routage.

## Alternatives rejetées

- **Conserver le vent du front** : perpétue l'ambiguïté et le risque d'ETA faux silencieux.
- **Vent de défaut 270°/12** : vent inventé — routage sur fiction.
- **Conversion apparente approximative** (angle apparent pris pour un vrai) : ETA faux sans erreur visible, exactement le risque que cette ADR élimine.
