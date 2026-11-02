# ADR-0004 — Autorité du vent : le serveur décide

- **Statut** : Accepté — 03/11/2026 (PR #104 + #105, issues #102/#103)
- **Décideurs** : Dom (feu vert C2), feuille de route #58 (dette D2, revue #88)
- **Liens** : `docs/archi.md` §7/§10 ; ADR-0003 (jobs) ; chantier C2

## Contexte

Trois pipelines de vent coexistaient (vent du point + barbes côté front, GRIB côté serveur, payload de routage). Le payload de routage transportait un « vent instruments » affiché par le front qui n'était en réalité qu'un repli : le serveur préférait toujours son GRIB frais. Confusion constatée le 02/11 — risque silencieux : un **ETA calculé sur un vent différent de celui affiché**, sans aucune erreur visible.

## Décision

Le **serveur** est l'autorité unique du vent de routage :

1. **GRIB frais prioritaire** (inchangé).
2. Sinon **repli constant dérivé du NMEA du serveur** : MWV vent vrai + cap (HDT/HDG) → `directionFromDeg = (cap + angle) % 360`. Sans vent vrai, sans cap, ou NMEA non frais (5 s) → **pas de repli**.
3. Le champ `wind` du **client est supprimé** aux deux points d'entrée (`/api/routing/compute` et `/api/routing/jobs`) puis remplacé par le vent serveur (`apply_server_wind_authority`) — le client ne peut plus influencer le vent du calcul.
4. Sans GRIB ni vent serveur : **refus clair** (`422`, message actionnable). Le vent de test 270°/12 kt par défaut est supprimé.
5. La réponse echo le repli effectif (`wind`, `null` si GRIB) — la vérité du calcul est `RoutingRouteResult.windSource`.

## Justifications

- Un routage silencieusement faux (vent calculé ≠ vent affiché) est pire qu'un refus explicite : l'ETA faux ne se voit pas.
- La conversion apparent → vrai est **exclue volontairement** : elle exigerait SOG et le vecteur vitesse du bateau ; le repli utilise MWV-T uniquement, et échoue explicitement sinon.
- Le front n'envoie plus que le plan (`start`, `finish`, `polarId`) — périmètre minimal, contrat testé de bout en bout (assertion d'absence du champ `wind` dans le POST).

## Conséquences

- Le vent affiché (point/barbes, Open-Météo/GRIB front) et le vent du routage peuvent différer **par construction** : ce n'est plus une ambiguïté mais un choix documenté.
- Tout futur chantier touchant au vent hérite d'une seule règle : le calcul se fait côté serveur, sur les données du serveur.
