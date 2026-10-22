# MyNavApp - Application de Navigation Maritime

Une application de tableau de bord personnelle pour visualiser les instruments de navigation de votre bateau.

## Fonctionnalités

- **GPS** : Position, heure de la mesure, précision, vitesse fond et route fond lorsque le navigateur les fournit
- **Carte marine** : Fond OpenStreetMap avec aides à la navigation OpenSeaMap
- **Vent** : Barbules météo basées sur les prévisions Open-Meteo aux emplacements visibles de la carte, avec vitesse, direction et rafales. Les points sont interrogés ensemble et rechargés après un déplacement/zoom (ainsi que toutes les 15 minutes); des positions proches peuvent avoir la même prévision selon la résolution des modèles météo
- **Sondeur** : Indiqué comme indisponible tant qu'aucun capteur compatible n'est connecté

## Installation

```bash
# Cloner le dépôt
git clone https://github.com/Dom6881org/MyNavApp.git
cd MyNavApp

# Installer les dépendances
npm install

# Lancer l'application en développement
npm run dev
```

## Utilisation

Au démarrage, l'application demande l'accès à la géolocalisation du navigateur. Autorisez la position pour centrer la carte et afficher les données disponibles. La géolocalisation nécessite un contexte sécurisé (HTTPS ou `localhost`).

- Changer le thème (clair, sombre, nuit)
- Modifier les unités de vitesse
- Arrêter ou relancer le GPS depuis les paramètres
- Le vent affiché est une prévision météo Open-Meteo, pas une mesure d'un capteur embarqué. La position GPS arrondie à deux décimales est envoyée à ce service pour obtenir la prévision
- Les données absentes du GPS, comme la profondeur ou la batterie, ne sont pas simulées

## Structure du projet

```
my-nav-app/
├── src/
│   ├── components/         # Composants React
│   │   ├── Speedometer.tsx
│   │   ├── Compass.tsx
│   │   ├── WindIndicator.tsx
│   │   ├── DepthSounder.tsx
│   │   ├── GPSDisplay.tsx
│   │   ├── InstrumentPanel.tsx
│   │   └── ControlPanel.tsx
│   ├── hooks/              # Hooks personnalisés
│   │   ├── useNavigationData.ts
│   │   └── useDashboardLayout.ts
│   ├── types/              # Types TypeScript
│   │   └── navigation.ts
│   ├── App.tsx             # Composant principal
│   ├── main.tsx            # Point d'entrée
│   ├── index.css           # Styles globaux
│   └── App.css             # Styles de l'application
├── package.json
├── vite.config.ts
├── tsconfig.json
└── index.html
```

## Personnalisation

### Ajouter un nouvel instrument

1. Créer un nouveau composant dans `src/components/`
2. Ajouter le type correspondant dans `src/types/navigation.ts`
3. Mettre à jour `InstrumentPanel.tsx` pour gérer le nouvel instrument

### Modifier les unités

Les unités disponibles sont définies dans `src/types/navigation.ts`. Vous pouvez ajouter de nouvelles unités en :

1. Ajoutant l'option dans le type `DashboardLayout`
2. Mettant à jour les fonctions de conversion dans les composants concernés

## Technologies utilisées

- **React 18** : Bibliothèque UI
- **TypeScript** : Typage statique
- **Vite** : Bundler et serveur de développement
- **CSS3** : Styles et animations

## Déploiement

Pour déployer l'application :

```bash
npm run build
```

Les fichiers seront générés dans le dossier `dist/`.

## Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.

## Licence

MIT
