# Decisions d'architecture (ADR)

Chaque décision structurante, irréversible ou contre-intuitive est documentée ici. Une ADR décrit **ce qui a été décidé, pourquoi, et ce qu'il ne faut pas régresser** — elle n'est jamais modifiée a posteriori (une nouvelle décision = une nouvelle ADR qui la remplace).

| ADR | Sujet | Statut |
|---|---|---|
| [ADR-0003](ADR-0003-routage-asynchrone-subprocess.md) | Calcul du routage asynchrone en subprocess (D1) | Accepté (02/11/2026) |
| [ADR-0004](ADR-0004-autorite-vent-serveur.md) | Autorité du vent serveur (D2/C2) | Accepté (03/11/2026) |

La numérotation 0001/0002 est réservée aux décisions fondatrices (séparation front/back, moteur `mynav-routing` séparé épinglé) — non rédigées à ce jour ; la description vivante de l'architecture reste dans [`../archi.md`](../archi.md).
