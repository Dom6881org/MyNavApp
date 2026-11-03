# MyNavApp v1.3.0 — Voile/moteur : le relais moteur sous seuil de vitesse voile

## Nouveautés
- **Relais moteur B1** (#133) : quand la vitesse voile prédite (SOG polaire) d'un tronçon passe sous le seuil — **2 kt par défaut, paramétrable** via le champ « Motor below (kt) » du panneau de routage (0 < x ≤ 10, vide = pur voile) — le tronçon passe en **moteur à 4,0 kt**, cap inchangé. La route au vent par pétoire, introuvable en pur voile (zone morte de la polaire), devient **trouvable et directe**.
- **Affichage moteur** : tronçons moteur tracés en **trait orange pointillé** distinct de la trace violette ; jambes concernées marquées **MOTOR** dans la fiche route détaillée ; note « engine legs under X kt sail speed » dans le panneau.
- **Moteur [mynav-routing v0.5.0](https://github.com/Dom6881org/mynav-routing/releases/tag/v0.5.0)** — `route(engine_below_kts=...)`, `RouteResult.motor_flags` par point (convention #123), `properties.motor` en GeoJSON (PR moteur #34).

## Technique
- `server/routing.py` : paramètre `engineBelowKts` du plan (validation 0 < x ≤ 10, absent/null = pur voile back-compat), `motorFlags` + echo `engineBelowKts` dans la réponse.
- `shared/navigation.ts` : `RoutingPlan.engineBelowKts`, `RoutingRouteResult.motorFlags`/`engineBelowKts`.
- `src/utils/routeLegs.ts` : jambes marquées `motor` (convention par point ou par tronçon déduite de la longueur, dégradation gracieuse) ; `src/components/MapViewSimple.tsx` (runs voile/moteur), `RoutingPanel.tsx` (champ + note), `RouteDetails.tsx` (badge MOTOR).
- `requirements-routing.txt` : pin `mynav-routing @ v0.5.0` (politique tags #56) ; `docs/archi.md` §5/§6/§10 à jour.

## Issues fermées
#133

# MyNavApp v1.2.0 — Routage rapide, asynchrone et fiable en côte

## Nouveautés
- **Moteur [mynav-routing v0.4.0](https://github.com/Dom6881org/mynav-routing/releases/tag/v0.4.0)** — épinglage désormais sur le tag (politique #56). Sampling GRIB numpy (17,1×), corridor d'élagage (~2×), pré-filtre crosses_land (≥3×) et **fallback sans corridor** : les routes contournant un cap (Cap Béar, Cap de Creus) ne sont plus refusées à tort (#84/#89/#93/#116, diagnostic #118 résolu).
- **Jobs routage asynchrones** (#95/#97, ADR-0003) : progression temps réel, bouton Annuler, paramètres effectifs (pas de temps, maille, durée de calcul) affichés dans le panneau (#100) ; garde-fou de 2 jobs simultanés côté serveur — 429 au-delà (#114).
- **Heure d'arrivée + SOG** (#18) : heure d'arrivée locale et sparkline SOG le long de la route.
- **Autorité vent serveur** (#102/#103, ADR-0004) : le front n'envoie plus de vent ; repli en vent constant dérivé du NMEA du serveur.
- **Barbes de vent robustes** : paliers de zoom anti-churn et plafonds de cache (#62), complément Open-Météo hors zone GRIB avec badge d'état (#82), couleurs par force.
- **Carte anti-clignotement** (#50) et chip « From » épurée (#52).
- **Qualité & docs** : campagne d'acceptation moteur « zéro terre » à chaque push CI (mynav-routing #30) ; ADR-0003/0004 + archi.md complet (#106/#108) ; README Installation complet, venv + HTTPS LAN mkcert (#112).

## Technique
- `server/routing.py`, `server/routing_jobs.py`, `requirements-routing.txt` (pin `mynav-routing @ v0.4.0`)
- CI : `frontend` (Node 22) + `server` ; ecCodes pip `>= 2.43`

## Issues fermées (principales)
#18, #50, #52, #62, #82, #95, #96, #100, #102, #103, #106, #108, #112, #114, #116, #118
