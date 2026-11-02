# ADR — Architecture Decision Records

Décisions d'architecture de MyNavApp, au format : Statut / Contexte / Décision / Conséquences / Alternatives rejetées.

| ADR | Titre | Statut |
|---|---|---|
| [ADR-0003](ADR-0003-routage-asynchrone-subprocess.md) | Routage asynchrone en subprocess (jobs `/api/routing/jobs`) | Accepté (02/11/2026) |
| [ADR-0004](ADR-0004-autorite-vent-serveur.md) | Autorité du vent de routage côté serveur | Accepté (03/11/2026) |

Les numéros 0001 et 0002 sont **réservés** : les décisions historiques antérieures (dépendance moteur épinglée, GRIB offline-first, SSE sans framework) sont déjà décrites dans [`docs/archi.md`](../archi.md) et n'ont pas été rétro-documentées en ADR.

Règle : toute décision structurelle future (nouvelle dette résolue, changement de contrat, choix technique engageant) s'ajoute ici dans la PR qui l'implémente — jamais après coup.
