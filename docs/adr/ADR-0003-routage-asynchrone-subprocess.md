# ADR-0003 — Routage asynchrone en subprocess (jobs `/api/routing/jobs`)

**Statut** : Accepté — en production depuis le 02/11/2026 (issues #95/#96, PR #97 back + #99 front, revue architecture #88 dette D1).

## Contexte

Le calcul de routage isochrone dure de ~54 s (config app figée : dt=3600/bin auto) à plusieurs minutes (lignes longues, maille fine). Historiquement exécuté **dans le processus serveur** (`compute_route_payload` appelé depuis le handler HTTP) :

- le GIL partageait le calcul avec les polls SSE, les tours de boucle NMEA/AIS et le rendu des réponses HTTP — preuve mesurée le 02/11 : **445 s via l'app vs 324 s** en appel direct ;
- aucune progression n'était remontée : l'UI affichait un calcul bloqué sans feedback ;
- aucune annulation n'était possible : une erreur de plan = attendre la fin (ou tuer le serveur).

## Décision

1. **`POST /api/routing/jobs`** répond `202 { jobId }` et exécute le calcul dans un **subprocess `multiprocessing`** (mode `spawn`, spawn-safe Windows). L'endpoint synchrone `POST /api/routing/compute` reste **intact** (rétrocompatibilité, tests dédiés).
2. **Progression honnête** : un thread monitor lit les `phase_timings` en place ~1 Hz (elapsed, explored_nodes, phases cumulées). **Pas de pourcentage estimé** — le total est inconnu, un % serait mensonger.
3. **Annulation** : `DELETE /api/routing/jobs/{jobId}` envoie SIGTERM puis SIGKILL si nécessaire ; idempotent ; `404` si inconnu.
4. **Reaping mono-propriétaire** : **seul** le thread monitor joint le `Process`. `cancel()` se contente de signaler puis d'attendre `finished_event` (posé par `_finish()`). Leçon du premier run CI rouge : `exitcode` est servi par `popen.poll()` en live et `popen_fork.poll()` **avale ECHILD sans fixer `returncode`** — si un deuxième thread reape en premier, `exitcode` reste `None` à jamais et `is_alive()` ment (risque de kill sur un PID recyclé). **Jamais deux threads qui joignent le même Process.**
5. **TTL 30 min** des jobs terminés ; le worker est un module de niveau module (pas de fermeture locale, picklable) et reçoit `compute_route_payload` en argument.
6. **`done` = résultat + `timings` + `params` effectifs** (`dt_s`, `bin_deg`) → boucle D3 : tout diagnostic perf/ETA terrain est lisible dans l'UI sans script.

## Conséquences

✅ UI fluide pendant le calcul ; annulation fiable ; diagnostics de perf lisibles ; le serveur reste réactif (GIL libéré).

⚠️ Limites acceptées en v1 : `daemon=True` (les jobs meurent avec le serveur), pas de garde-fou sur le nombre de jobs simultanés (résidu R2, basse priorité — le front annule le job précédent), pas de timeout client de polling (résidu R3 — garanti par le monitor serveur qui marque `failed` si le subprocess meurt).

## Alternatives rejetées

- **Thread dédié** : ne libère pas le GIL pour un calcul numpy pur Python entre les phases.
- **Calcul dans le process + async** : complexité équivalente sans isolation de GIL.
- **File externe (Celery, RQ…)** : contradictoire avec le choix stdlib-only du backend.
- **Progression en %** : indicateur inventé — la progression brute (nœuds explorés, temps par phase) est exploitable sans mentir.
