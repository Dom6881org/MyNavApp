# Profilage local du rendu cartographique

Lancer `npm run dev:profile` pour activer l'instrumentation locale. Sans cette
variable d'environnement, les mesures et le `Profiler` React ne sont pas
activés.

Dans les outils de développement du navigateur :

1. Dans **React DevTools / Profiler**, relever le coût de commit de `MapView`
   pour un tick GPS au mouillage. Dans **Performance**, enregistrer séparément
   ce scénario, un pan libre pendant 30 secondes et un zoom rapide avec paliers
   jusqu'à z14+. Utiliser la même fenêtre, le même appareil et le même navigateur
   pour chaque comparaison.
2. Dans **Console**, relever les événements `[map-perf]`. `react-map-commit`
   donne la durée React (`actualDuration`, phase et durée de base) ;
   `wind-barb-sync` donne le coût de synchronisation, le nombre de barbes
   conservées (`count`), les barbes ajoutées/modifiées/supprimées et le zoom.
   Le pane Leaflet `wind-barbs` porte également `data-wind-barbs-count`.
3. Dans **Performance**, noter le FPS moyen/minimum et les frames perdues.
   Pour isoler le filtre de fond, répéter le pan en styles de carte standard,
   muted et faded, sans changer l'échelle ni le scénario.
4. Répéter le pan z14+ hors de la zone GRIB puis dans cette zone. Relever dans
   **Network** les requêtes météo et leurs statuts, dont les éventuels 429, ainsi
   que `status.gridError`.

Rapporter pour chaque mesure : navigateur/OS, taille de fenêtre, zoom, scénario,
nombre de barbes, style de fond, durée React, durée `wind-barb-sync`, FPS et
frames perdues. Objectifs à vérifier sur un laptop : pan à au moins 50 FPS et
travail React de moins de 16 ms par tick GPS. Comparer les temps synchrones
séparément des frames : les marqueurs donnent le travail JavaScript/React, tandis
que Performance permet d'observer le coût de rendu du navigateur et des
transitions CSS. Aucun résultat de terrain n'est prérempli : les valeurs doivent
être relevées sur l'appareil utilisé pour la reproduction.
