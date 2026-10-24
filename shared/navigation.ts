export interface Position {
  latitude: number;
  longitude: number;
}

export interface SpeedData {
  speed: number | null;
  sog: number | null;
  stw: number | null;
  maxSpeed: number | null;
  averageSpeed: number | null;
}

export interface WindData {
  direction: number;
  speed: number;
  gust: number;
  source: 'Open-Meteo';
}

export interface ApparentWindData {
  angleDegrees: number;
  speedKnots: number;
}

export interface WindForecastStatus {
  isLoading: boolean;
  error: string | null;
  updatedAt: number | null;
  gridError: string | null;
}

export interface WindForecastPoint {
  position: Position;
  wind: WindData;
}

export interface CompassData {
  heading: number | null;
  cog: number | null;
  magneticHeading: number | null;
  deviation: number;
}

export interface DepthData {
  depth: number;
  temperature: number;
  alarm: boolean;
  alarmDepth: number;
}

export interface GPSTime {
  utcTime: string;
  localTime: string;
  date: string;
}

export interface NavigationData {
  position: Position | null;
  speed: SpeedData | null;
  wind: WindData | null;
  apparentWind: ApparentWindData | null;
  windGrid: WindForecastPoint[];
  windForecastStatus: WindForecastStatus;
  compass: CompassData | null;
  depth: DepthData | null;
  gpsTime: GPSTime | null;
  gpsAccuracy: number | null;
}

export interface BrowserNavigationUpdate {
  position: Position;
  speed: SpeedData | null;
  compass: CompassData | null;
  gpsTime: GPSTime | null;
  gpsAccuracy: number | null;
  receivedAt: number;
}

export interface BackendNavigationSnapshot {
  source: 'nmea' | 'browser' | 'none';
  nmeaConnected: boolean;
  updatedAt: number | null;
  navigation: Pick<NavigationData, 'position' | 'speed' | 'compass' | 'depth' | 'gpsTime' | 'gpsAccuracy' | 'apparentWind'>;
  ais: AISBackendState;
}

export type AISSource = 'local' | 'internet';

export interface AISTarget {
  mmsi: string;
  name: string | null;
  latitude: number;
  longitude: number;
  sog: number | null;
  cog: number | null;
  heading: number | null;
  navigationalStatus: number | null;
  updatedAt: number;
}

export interface AISBackendState {
  source: AISSource;
  localNmeaPort: number | null;
  targets: AISTarget[];
  localTargetCount: number;
  internetTargetCount: number;
  internetConfigured: boolean;
  internetConnected: boolean;
  internetError: string | null;
}

export type InstrumentType = 'speed' | 'wind' | 'compass' | 'depth' | 'map' | 'all';

export interface InstrumentConfig {
  id: string;
  type: InstrumentType;
  title: string;
  visible: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

export interface DashboardLayout {
  instruments: InstrumentConfig[];
  theme: 'light' | 'dark' | 'night';
  units: {
    speed: 'knots' | 'kmh' | 'mph';
    depth: 'meters' | 'feet' | 'fathoms';
    temperature: 'celsius' | 'fahrenheit';
  };
}

export type UnitChangeHandler = <K extends keyof DashboardLayout['units']>(
  unitType: K,
  value: DashboardLayout['units'][K]
) => void;
