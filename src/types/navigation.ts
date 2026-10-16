// Types pour les données de navigation maritime

export interface Position {
  latitude: number;
  longitude: number;
}

export interface SpeedData {
  speed: number; // en nœuds (knots) - vitesse du bateau
  sog: number; // en nœuds (knots) - Speed Over Ground from GPS
  maxSpeed: number;
  averageSpeed: number;
}

export interface WindData {
  direction: number; // en degrés (0-360)
  speed: number; // en nœuds
  gust: number; // rafales en nœuds
}

export interface CompassData {
  heading: number; // cap en degrés (0-360) - où le bateau pointe
  cog: number; // Course Over Ground en degrés (0-360) - où le bateau va (from GPS)
  magneticHeading: number;
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
  position: Position;
  speed: SpeedData;
  wind: WindData;
  compass: CompassData;
  depth: DepthData;
  gpsTime: GPSTime;
  batteryVoltage: number;
  signalStrength: number; // 0-100%
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
