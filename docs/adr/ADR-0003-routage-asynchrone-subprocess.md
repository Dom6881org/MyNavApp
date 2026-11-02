# ADR-0003 — Calcul du routage asynchrone en subprocess

- **Statut** : Accepté — en production depuis le 02/11/2026 (PR #97, issue #95 ; achèvement D3 : #100/#101)
- **Décideurs** : Dom (approbateur unique), revue architecture #88 (dette D1), découpe §6
- **Liens** : `docs/archi.md` §5 (API jobs) ; feuille de route #58

## Contexte

Le routage était calculé dans le processus serveur (`compute_route_payload` appelé depuis le handler HTTP). Sous GIL, un calcul long (jusqu'à 445 s relevés, contre 324 s en calcul isolé) partageait le CPU avec les polls SSE/tuiles ; aucune progression ni annulation n'était possible ; un crash du calcul emportait le serveur. Dette **D1** de la revue #88.

## Décision

Le calcul de route s'exécute dans un **subprocess** (`multiprocessing`, mode `spawn` — sûr sous Windows) :

- `POST /api/routing/jobs` → `202 { jobId }` ; `GET /api/routing/jobs/{jobId}` → état (`queued`/`running`/`done`/`failed`/`cancelled`) avec **progression honnête** (~1 Hz : temps écoulé + nœuds explorés bruts, pas de pourcentage estimé) ; `DELETE` → annulation idempotente.
- L'endpoint synchrone `POST /api/routing/compute` est **conservé intact** (rétrocompatibilité prouvée par test dédié dans la PR #97).
- Le résultat `done` embarque payload + `timings` (phases) + `params` effectifs (`dt_s`, `bin_deg`) — règle D3 : tout diagnostic perf/ETA est lisible dans l'UI sans script ni relecture de code.
- TTL des jobs terminés : 30 minutes (purge).

## Justifications d'implémentation — à ne pas régresser

1. **Reaping à propriétaire unique** : seul le thread **monitor** join le `Process`. `exitcode` est une propriété en poll live CPython et `popen_fork.poll()` avale `ECHILD` sans fixer `returncode` : si un second thread reape, `exitcode` reste `None` à jamais et `is_alive()` ment (risque de kill sur un PID recyclé). `cancel()` **signale** (SIGTERM, puis SIGKILL au besoin) et attend l'`Event` posé par `_finish()` — il ne join jamais. (Fix de la race CI du 02/11, PR #97, commit `1ca1f5f1`.)
2. **terminate → kill** : SIGTERM puis SIGKILL après délai de grâce ; pas de zombie.
3. **Spawn-safe** : le worker est défini au niveau du module ; le payload est passé picklable en argument — aucune fermeture ni objet non picklable ne traverse la frontière `spawn`.
4. **Résidus assumés (v1)** : threads `daemon=True` (les jobs meurent avec le serveur) ; pas de garde-fou sur le nombre de jobs simultanés (R2) ; pas de timeout client de polling (R3) — garanti par le monitor qui marque `failed` si le subprocess meurt.

## Conséquences

- L'UI reste fluide pendant le calcul (front #96/#99 : polling ~1 s, bouton Annuler, relance = annulation du précédent).
- Un échec de calcul n'impacte plus le serveur.
- Toute évolution du job doit préserver l'invariant n°1 : **jamais deux threads qui join le même `Process`**.
