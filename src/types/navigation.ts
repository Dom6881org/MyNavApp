// Types pour les données de navigation maritime

export interface Position {
  latitude: number;
  longitude: number;
}

export interface SpeedData {
  speed: number | null; // vitesse fournie par le GPS, en nœuds
  sog: number | null; // vitesse fond calculée à partir des positions GPS
  maxSpeed: number | null;
  averageSpeed: number | null;
}

export interface WindData {
  direction: number; // en degrés (0-360)
  speed: number; // en nœuds
  gust: number; // rafales en nœuds
  source: 'Open-Meteo';
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
  heading: number | null; // cap fourni par le GPS, en degrés
  cog: number | null; // route fond calculée à partir des positions GPS
  magneticHeading: number | null;
  deviation: number;
}

export interface DepthData {
  depth: number; // en mètres
  temperature: number; // température de l'eau en °C
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
  windGrid: WindForecastPoint[];
  windForecastStatus: WindForecastStatus;
  compass: CompassData | null;
  depth: DepthData | null;
  gpsTime: GPSTime | null;
  gpsAccuracy: number | null;
}

// Types pour les instruments
export type InstrumentType = 'speed' | 'wind' | 'compass' | 'depth' | 'gps' | 'map' | 'all';

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
