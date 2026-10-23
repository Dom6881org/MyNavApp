# MyNavApp - Marine Navigation Dashboard

A personal dashboard for viewing your vessel's navigation instruments.

## Features

- **GPS**: Position, fix time, accuracy, SOG and COG when provided or calculated from browser GPS data
- **Marine chart**: A chart-first layout with a swipeable strip of graphical instruments, OpenStreetMap base tiles, OpenSeaMap navigation marks, a past-position trail, and north-up, heading-up or course-up map orientation
- **Wind**: The instrument shows apparent wind speed (AWS) and angle (AWA), at 0 until an anemometer is connected. Hover over map wind barbs for Open-Meteo forecast speed, direction and gusts at that location. The local forecast updates every 15 minutes; map forecasts update after movement/zoom, at most once per minute. Nearby points may show the same forecast because weather models have limited resolution
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

## Local GPS replay fixture

`test-data/navionics-track.json` is generated locally from a Navionics GPX export. It contains timestamped positions, elevations, horizontal accuracy, and Navionics speed converted from m/s to knots as SOG. Position-derived SOG is retained as a fallback, and COG is calculated between consecutive trackpoints. During replay, STW falls back to SOG because the GPX has no water-speed sensor data. The fixture contains exact location history and is git-ignored; review it carefully before sharing.

In the Vite development server, use **▶ GPX replay** to view the track on the map and instruments. Select 1×, 10× or 60× playback speed; stopping replay clears its trail and resumes device GPS. The local fixture endpoint is available only from loopback and is not included in production builds.

Map rotation is provided at runtime by [`@tomickigrzegorz/leaflet-rotate`](https://github.com/tomickigrzegorz/leaflet-rotate) 0.3.0, distributed under the MIT License; see [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).

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
