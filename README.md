# MyNavApp - Application de Navigation Maritime

Une application de tableau de bord personnelle pour visualiser les instruments de navigation de votre bateau.

## Fonctionnalités

- **Vitesse** : Affichage de la vitesse actuelle, maximale et moyenne
- **Compas** : Rose des vents avec cap magnétique et vrai
- **Vent** : Direction et vitesse du vent avec indication des rafales
- **Sondeur** : Profondeur, température de l'eau et alarme de profondeur
- **GPS** : Position, heure UTC et force du signal

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

L'application se lance automatiquement avec des données simulées. Vous pouvez :

- Changer le thème (clair, sombre, nuit)
- Modifier les unités de mesure (vitesse, profondeur, température)
- Connecter/Déconnecter la simulation
- Réinitialiser les données
- Réorganiser les instruments (à venir)

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
