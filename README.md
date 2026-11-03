# MyNavApp - Marine Navigation Dashboard

A personal dashboard for viewing your vessel's navigation instruments.

The frontend requires Node.js 20.6 or later. The Python backend requires Python 3.10 or later.

## Features

- **Position and time**: Latitude/longitude and UTC/local date and time are shown in readouts over the map; SOG and COG appear in the speed and course instruments
- **Speed**: The speedometer dial is graduated 0 to 15 knots and shows STW and SOG. The maximum speed since the last reset is tracked across all data sources (browser GPS, NMEA, GPX replay) and shown as a MAX readout with a red marker on the dial at the max position; the RESET button next to it clears the session maximum
- **Instrument display modes**: The speed, course and wind instruments each have a DIGITAL button in the top-right corner that switches between the dial view and a digital view where the readings (STW/SOG/MAX, COG/HDG, wind speed and angle) fill the instrument card with large numbers; the selected mode is remembered per instrument in the browser
- **Marine chart**: A chart-first layout. On screens at least 900 px wide that are wider than tall (laptops, landscape tablets), speed and course sit on the left of the map and wind and depth on the right. On portrait or narrow screens, speed and course are in a row above the map and wind and depth in a row below it (phones scroll horizontally). The chart background (OSM land) can be toned down in Settings → Chart background (Standard, Muted land, Faded land; saved in the browser) so the OpenSeaMap marks stand out. The map follows the vessel: it stays centred on the boat until you drag the map, and the centre-on-vessel button (highlighted while following) resumes following. The UTC/local time and date are shown at the top centre of the chart and the vessel latitude/longitude at the bottom centre (theme-aware). The map orientation (north-up, heading-up, course-up) is a single map tool button under the centre-on-vessel button: each click cycles to the next mode and its badge shows N, H or C. There is no page header or footer: the whole screen is used for instruments and chart. The MyNavApp logo (`public/logo.svg`, also the favicon) is the first button of the map toolbar and opens a small About panel (app version taken from `package.json`, backend status, position source, data providers). Includes OpenStreetMap base tiles, OpenSeaMap navigation marks and a past-position trail
- **Wind**: The instrument shows apparent wind speed (AWS) and angle (AWA) when an onboard anemometer is available; otherwise it uses Open-Meteo forecast wind speed and direction and labels it as forecast data. Hover over map wind barbs for forecast speed, direction and gusts at that location. The local forecast updates every 15 minutes. Map forecasts are cached in memory (20 min) on a fixed geographic lattice, so panning and zooming out reuse already-loaded points and display instantly; the area around the view (and one zoom level out) is prefetched in batches of 50 points, so the first load is slightly slower. Cached forecasts are refreshed every 15 minutes and on failure retried after 30 s (with rate-limit backoff). Nearby points may show the same forecast because weather models have limited resolution
- **Depth**: Shown as unavailable until a compatible depth sounder is connected
- **Track recording**: The record button in the map toolbar starts and stops recording the merged navigation (NMEA or browser GPS) in the backend, so a recording keeps running across page reloads and clients. The track panel lists saved tracks and exports each one as GeoJSON, GPX or CSV

## Local backend

The React app runs as a Vite frontend and talks to a separate Python service. The service accepts browser GPS updates over HTTP, receives NMEA 0183 sentences over UDP (default port `10111`), and publishes merged navigation data over Server-Sent Events. RMC, GGA, VTG, HDT, HDG, DPT, DBT and relative MWV sentences are currently parsed. NMEA data takes precedence while fresh; browser GPS is the fallback.

`npm run dev` starts both processes (install Python 3.10+ and Node.js 20.6+ first). The API is proxied through Vite at `/api`; `npm run build` type-checks and builds the frontend, and `npm start` serves the built frontend and API from one origin. Run the backend tests with `npm run test:server` and lint the frontend with `npm run lint` (ESLint config in `.eslintrc.cjs`). Backend settings can be provided as environment variables or in the ignored root `.env` file; process environment variables take precedence. Configure `NMEA_UDP_PORT=0` to disable the UDP listener, or set `NMEA_UDP_PORT`, `NMEA_UDP_HOST`, `PORT`, and `HOST` for the boat's network. The HTTP API binds to loopback by default. Configure the NMEA gateway to send UDP sentences to the selected port. To test from another LAN device (e.g. a tablet on the same network), use `npm run dev:lan` (Vite on `0.0.0.0`, port 5173; the backend stays on loopback behind the `/api` proxy) or, after `npm run build`, `npm run start:lan` (backend and frontend on `0.0.0.0`, port `PORT`, default 3001). Then open `http://<PC-IP>:<port>` on the device (find the IP with `ipconfig`) and allow the port in the Windows firewall if needed.

The LAN mode is an early development feature: the API and Vite server do not yet provide authentication, and the production backend does not provide HTTPS. Use loopback by default, and expose it only on a trusted, firewalled boat network. Browser geolocation on other devices requires a secure context: for `npm run dev:lan`, the Vite dev server can serve HTTPS — set `VITE_HTTPS_CERT` and `VITE_HTTPS_KEY` in `.env` to the paths of a certificate trusted by the client devices (e.g. generated with mkcert for `localhost <PC-IP>`, see `.env.example`) and open `https://<PC-IP>:5173`. NMEA-fed positions are available without client geolocation.

### HTTPS for LAN devices (mkcert)

Browser geolocation on phones/tablets requires a secure context, so the LAN URL must be served over HTTPS. The Vite dev server reads `VITE_HTTPS_CERT`/`VITE_HTTPS_KEY` from `.env`; generate a locally-trusted certificate with [mkcert](https://github.com/FiloSottile/mkcert):

```bash
# 1. Install mkcert once: winget install FiloSottile.mkcert
#    (or: choco install mkcert / scoop install mkcert)
# 2. Install the local CA (once per PC, admin rights)
mkcert -install

# 3. Find your PC LAN IP (ipconfig), then generate the certificate
#    at the repository root
mkcert localhost 127.0.0.1 192.168.1.42        # use YOUR PC LAN IP

# 4. Point .env at the generated files (suffix = number of names)
#    VITE_HTTPS_CERT=./localhost+3.pem
#    VITE_HTTPS_KEY=./localhost+3-key.pem

# 5. Start the LAN dev server, then open https://<PC-IP>:5173 on the device
npm run dev:lan
```

Notes:

- Allow the Vite port (5173) in the Windows firewall when prompted.
- Client devices must also trust the mkcert root CA: `mkcert -CAROOT` prints the folder containing `rootCA.pem`. Send that file to the phone/tablet and install it (iOS: install the profile, then enable full trust in Settings → General → About → Certificate Trust Settings; Android: Settings → Security → Install a certificate → CA certificate).
- The certificate covers the PC's current LAN IP: regenerate it if the IP changes.
- The generated `.pem` files are git-ignored (`*.pem` in `.gitignore`) — local only, never commit them.

### Offline charts

The chart loads Leaflet and its rotation plugin from the app bundle (no CDN), and requests tiles from the backend at `/api/tiles/{osm|seamark}/{z}/{x}/{y}.png`. Tiles found in the local `tiles/` directory (configurable with `TILES_DIR`, ignored by Git) are served from disk; when a tile is missing the backend fetches it from the online provider, keeping browser tile requests same-origin. Pre-download your cruising area to use the chart without Internet:

```bash
python tools/download_tiles.py --bbox 47.0,-5.0,48.2,-2.5 --zooms 8-16
```

OpenStreetMap serves the base layer and OpenSeaMap the seamarks; 404s on open water (no seamark tile) are skipped. Keep the area and zoom range reasonable: a 100 × 100 km coastal region at zooms 8–17 is typically a few GB. Wind forecast (Open-Meteo) and Internet AIS remain online-only features; local VHF AIS, NMEA instruments and the chart keep working offline.


### Routing bathymetry (GEBCO)

Routing avoids water shallower than `ROUTING_MIN_DEPTH_M` (default 10 m) by sampling GEBCO elevation data along candidate legs. The depth constraint is disabled when no bathymetry is configured. Two file formats are accepted:

1. **GEBCO NetCDF** — the official product: variable `elevation`, dimensions `lat`/`lon`, elevation in meters (GEBCO convention: negative = depth below sea level, positive = land). Download the global 15 arc-second grid (~1 GB) or, preferably, a **regional subset** of your cruising area from the [GEBCO download portal](https://download.gebco.net/) — pick the **netCDF** format, not GeoTIFF/ESRI ASCII. Read via `xarray` + `netCDF4` (both in `requirements-routing.txt`).
2. **`.npz`** — a lightweight custom extract with keys `elev` (2D array, meters), `lats`, `lons`. No extra dependency (numpy only); handy for an offline Raspberry Pi install.

Configure in the ignored root `.env` file (see `.env.example`) and restart the backend — the grid is loaded once per process:

```bash
# Local file (priority) — e.g. a regional extract downloaded from the portal
MYNAV_ROUTING_BATHY_FILE=./data/gebco_extract.nc
# OR a URL, downloaded once then cached on disk and reused offline afterwards
# MYNAV_ROUTING_BATHY_URL=https://example.org/gebco_extract.nc
# Minimum depth kept by the routing, in meters (default 10)
# ROUTING_MIN_DEPTH_M=10
```

Existing installs need a one-time `python -m pip install -r requirements-routing.txt` to get `netCDF4`. Outside the grid coverage no depth constraint is applied (deep ocean assumed); land is always handled by the land mask.

### Track recording and export

Recording runs in the Python backend: start it with the record button in the map toolbar (or `POST /api/tracks/start`), stop it with the same button (`POST /api/tracks/stop`). A recording keeps running across frontend reloads and records the merged position whether it comes from NMEA or browser GPS; the development GPX replay is not recorded. Points are written to `tracks/` (configurable with `TRACKS_DIR`, ignored by Git) in one JSONL file per track, flushed continuously: a power loss on the Raspberry loses at most the last second. A point is stored when the vessel has moved at least 5 m since the previous one, and at most one point per second; when stationary, a heartbeat point is kept every 60 s. Each point keeps SOG, COG, heading, depth and GPS accuracy when available.

`GET /api/tracks` returns the recorder status and the list of saved tracks. Each track can be downloaded with `GET /api/tracks/{id}/export?format=geojson|gpx|csv` (GeoJSON LineString with `coordTimes`, GPX 1.1 `<trk>`, or CSV with one row per point) and removed with `DELETE /api/tracks/{id}`. The track panel on the chart offers the same actions as links.

### AIS targets

Install the Python backend dependencies with `python -m pip install -r requirements.txt`. To configure Internet AIS, copy `.env.example` to `.env`, replace the placeholder with your AISstream key, and restart the app with `npm run dev`. The `.env` file is local and ignored by Git; do not share it or commit it. Configure the VHF/AIS receiver or NMEA gateway to send NMEA 0183 UDP to `NMEA_UDP_HOST:NMEA_UDP_PORT` (default `0.0.0.0:10111`). Use the compact right-side map tools to open Settings directly on the chart, view GPS status, control development GPX replay, toggle AIS targets and the weather layer, and open AIS source/status and weather forecast details. The Settings panel contains GPS connection, theme, and unit controls. AIS settings select **Local VHF · NMEA/UDP** or **Internet · AISstream** and display the detected target count. When targets are available, **Zoom to targets** fits them on the chart. Local AIS target reports are kept for up to 10 minutes.

Internet AIS uses AISstream.io and requires an API key configured only on the server as `AISSTREAM_API_KEY`; never put the key in frontend settings or commit it. AISstream is subscribed to a small area around the latest vessel GPS position (about 15 nautical miles in each direction, adjusted for longitude). During GPX replay, the replay position is used for the subscription area; when replay stops, AISstream returns to the live GPS/NMEA position. Internet AIS availability depends on AISstream coverage and service limits.

AIS positions may be delayed or unavailable and are for situational awareness only; they are not a substitute for a certified AIS receiver, official chart, or collision-avoidance equipment.

### Navigation abbreviations

- **SOG** - Speed Over Ground
- **COG** - Course Over Ground
- **HDG** - Heading; not currently available because browser GPS does not provide vessel-heading sensor data
- **LAT / LON** - Latitude / Longitude

## Installation

Prerequisites: [Git](https://git-scm.com), [Node.js](https://nodejs.org) 20.6+ (22 LTS recommended) and [Python](https://www.python.org/downloads/) 3.10+ (3.12 recommended; on Windows, include the `py` launcher when installing Python).

```bash
# Clone the repository
git clone https://github.com/Dom6881org/MyNavApp.git
cd MyNavApp

# Create and activate a Python virtual environment
py -3.12 -m venv .venv            # Windows ("python3.12 -m venv .venv" on Linux/macOS)
.venv\Scripts\activate            # Windows (".venv/bin/activate" on Linux/macOS)

# Backend dependencies: server + routing engine (pinned mynav-routing commit) + GRIB
# (ecCodes ships its native library inside the wheel since 2.43: pip is enough, no conda)
python -m pip install --upgrade pip
python -m pip install -r requirements.txt -r requirements-routing.txt

# Frontend dependencies
npm install

# Start the app (Python backend + Vite dev server), then open http://localhost:5173
npm run dev
```

Notes:

- `npm run dev` starts the backend with the `python` of the current terminal: **activate the venv in every new terminal** before running the app, otherwise the backend misses its dependencies. If PowerShell refuses to run `Activate.ps1`, run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` once.
- After a routing-engine pin bump, update it with `python -m pip install --force-reinstall -r requirements-routing.txt` and restart the app (a running server never picks up the new package).
- Optional local configuration: copy `.env.example` to `.env` (AISstream key, NMEA/HTTP ports, HTTPS certificates for LAN geolocation); the file is git-ignored.
- HTTPS for LAN devices (geolocation on phones/tablets): follow [HTTPS for LAN devices (mkcert)](#https-for-lan-devices-mkcert) below.
- Offline charts: `python tools/download_tiles.py --bbox 47.0,-5.0,48.2,-2.5 --zooms 8-16` pre-downloads a cruising area into `tiles/`.
- Verify the install: `npm run test:front` and `npm run test:server` (routing tests are skipped automatically when the engine is missing).

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
