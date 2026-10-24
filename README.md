# MyNavApp - Marine Navigation Dashboard

A personal dashboard for viewing your vessel's navigation instruments.

The frontend requires Node.js 20.6 or later. The Python backend requires Python 3.10 or later.

## Features

- **GPS**: Position, fix time, accuracy, SOG and COG when provided or calculated from browser GPS data
- **Marine chart**: A chart-first layout with speed, wind and course instruments beside the map on wide screens and above it on mobile, plus depth and GPS below the chart. Depth and GPS can be hidden independently in Settings. Includes OpenStreetMap base tiles, OpenSeaMap navigation marks, a past-position trail, and north-up, heading-up or course-up map orientation
- **Wind**: The instrument shows apparent wind speed (AWS) and angle (AWA) when an onboard anemometer is available; otherwise it uses Open-Meteo forecast wind speed and direction and labels it as forecast data. Hover over map wind barbs for forecast speed, direction and gusts at that location. The local forecast updates every 15 minutes; map forecasts update after movement/zoom, at most once per minute. Nearby points may show the same forecast because weather models have limited resolution
- **Depth**: Shown as unavailable until a compatible depth sounder is connected

## Local backend

The React app runs as a Vite frontend and talks to a separate Python service. The service accepts browser GPS updates over HTTP, receives NMEA 0183 sentences over UDP (default port `10111`), and publishes merged navigation data over Server-Sent Events. RMC, GGA, VTG, HDT, HDG, DPT, DBT and relative MWV sentences are currently parsed. NMEA data takes precedence while fresh; browser GPS is the fallback.

`npm run dev` starts both processes (install Python 3.10+ and Node.js 20.6+ first). The API is proxied through Vite at `/api`; `npm run build` type-checks and builds the frontend, and `npm start` serves the built frontend and API from one origin. Run the backend tests with `npm run test:server`. Backend settings can be provided as environment variables or in the ignored root `.env` file; process environment variables take precedence. Configure `NMEA_UDP_PORT=0` to disable the UDP listener, or set `NMEA_UDP_PORT`, `NMEA_UDP_HOST`, `PORT`, and `HOST` for the boat's network. The HTTP API binds to loopback by default. Configure the NMEA gateway to send UDP sentences to the selected port. To test from another LAN device, set both `HOST=0.0.0.0` and `VITE_HOST=0.0.0.0` as appropriate.

The LAN mode is an early development feature: the API and Vite server do not yet provide authentication or HTTPS. Use loopback by default, and expose it only on a trusted, firewalled boat network. Browser geolocation on other devices may also require HTTPS; NMEA-fed positions are available without client geolocation.

### AIS targets

Install the Python backend dependencies with `python -m pip install -r requirements.txt`. To configure Internet AIS, copy `.env.example` to `.env`, replace the placeholder with your AISstream key, and restart the app with `npm run dev`. The `.env` file is local and ignored by Git; do not share it or commit it. Configure the VHF/AIS receiver or NMEA gateway to send NMEA 0183 UDP to `NMEA_UDP_HOST:NMEA_UDP_PORT` (default `0.0.0.0:10111`). Use the compact right-side map tools to open Settings directly on the chart, view GPS status, control development GPX replay, toggle AIS targets and the weather layer, and open AIS source/status and weather forecast details. The Settings panel contains GPS connection, instrument visibility, theme, and unit controls. AIS settings select **Local VHF · NMEA/UDP** or **Internet · AISstream** and display the detected target count. When targets are available, **Zoom to targets** fits them on the chart. Local AIS target reports are kept for up to 10 minutes.

Internet AIS uses AISstream.io and requires an API key configured only on the server as `AISSTREAM_API_KEY`; never put the key in frontend settings or commit it. AISstream is subscribed to a small area around the latest vessel GPS position (about 15 nautical miles in each direction, adjusted for longitude). During GPX replay, the replay position is used for the subscription area; when replay stops, AISstream returns to the live GPS/NMEA position. Internet AIS availability depends on AISstream coverage and service limits.

AIS positions may be delayed or unavailable and are for situational awareness only; they are not a substitute for a certified AIS receiver, official chart, or collision-avoidance equipment.

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
python -m pip install -r requirements.txt

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

In the Vite development server, use the play control in the map toolbar to view the track on the map and instruments. Open its info button to select 1×, 10× or 60× playback speed and view replay progress; stopping replay clears its trail and resumes device GPS. The local fixture endpoint is available only from loopback and is not included in production builds.

Map rotation is provided at runtime by [`@tomickigrzegorz/leaflet-rotate`](https://github.com/tomickigrzegorz/leaflet-rotate) 0.3.0, distributed under the MIT License; see [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).

## Project structure

```
my-nav-app/
├── server/                 # Python HTTP/SSE and NMEA UDP backend
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
