# MyNavApp - Marine Navigation Dashboard

A personal dashboard for viewing your vessel's navigation instruments.

## Features

- **GPS**: Position, fix time, accuracy, SOG and COG when provided or calculated from browser GPS data
- **Marine chart**: OpenStreetMap base map with OpenSeaMap navigation marks
- **Wind**: The instrument shows apparent wind speed (AWS) and angle (AWA), at 0 until an anemometer is connected. Hover over map wind barbs for Open-Meteo forecast speed, direction and gusts at that location. Forecast points are refreshed after map movement/zoom and every 15 minutes. Nearby points may show the same forecast because weather models have limited resolution
- **Depth**: Shown as unavailable until a compatible depth sounder is connected

### Navigation abbreviations

- **SOG** - Speed Over Ground
- **COG** - Course Over Ground
- **HDG** - Heading; not currently available because browser GPS does not provide vessel-heading sensor data
- **LAT / LON** - Latitude / Longitude

## Installation

```bash
# Clone the repository
git clone https://github.com/Dom6881org/MyNavApp.git
cd MyNavApp

# Install dependencies
npm install

# Start the development server
npm run dev
```

## Usage

At startup, the app requests browser geolocation permission. Allow location access to center the chart and show available navigation data. Geolocation requires a secure context (HTTPS or `localhost`).

- Change the theme (light, dark, night)
- Change speed and depth units
- Stop or restart GPS from Settings
- Wind values are Open-Meteo forecasts, not readings from an onboard sensor. The GPS position rounded to two decimal places is sent to Open-Meteo to retrieve the forecast
- Data not provided by GPS, such as depth or battery, is not simulated

## Project structure

```
my-nav-app/
├── src/
│   ├── components/         # React components
│   ├── hooks/              # Custom React hooks
│   ├── types/              # TypeScript types
│   ├── App.tsx             # Main application
│   ├── main.tsx            # Entry point
│   ├── index.css           # Global styles
│   └── App.css             # Application styles
├── package.json
├── vite.config.ts
├── tsconfig.json
└── index.html
```

## Build

```bash
npm run build
```

Production files are generated in the `dist/` directory.

## License

MIT
