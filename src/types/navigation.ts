// Types for marine navigation data.

export interface Position {
  latitude: number;
  longitude: number;
}

export interface SpeedData {
  speed: number | null; // Device-reported speed, in knots.
  sog: number | null; // Speed over ground from GPS or track data, in knots.
  stw: number | null; // Speed through water from a compatible sensor, in knots.
  maxSpeed: number | null;
  averageSpeed: number | null;
}

export interface WindData {
  direction: number; // Degrees (0-360).
  speed: number; // Knots.
  gust: number; // Gusts in knots.
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
  heading: number | null; // Direction of travel reported by GPS, in degrees.
  cog: number | null; // Course over ground calculated from GPS positions, in degrees.
  magneticHeading: number | null;
  deviation: number; // Degrees.
}

export interface DepthData {
  depth: number; // Meters.
  temperature: number; // Water temperature in °C.
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

// Instrument configuration types.
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
