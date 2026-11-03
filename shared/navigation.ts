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
  /** Origine du vent : Open-Météo (point/forecast) ou GRIB local (option B, #36). */
  source: 'Open-Meteo' | 'GRIB';
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
  trueWind: ApparentWindData | null;
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
  navigation: Pick<NavigationData, 'position' | 'speed' | 'compass' | 'depth' | 'gpsTime' | 'gpsAccuracy' | 'apparentWind' | 'trueWind'>;
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
  /** Source actually serving the targets ("internet" when falling back from a silent local NMEA stream). */
  source: AISSource;
  /** Source selected by the user in the AIS panel. */
  requestedSource: AISSource;
  localNmeaPort: number | null;
  targets: AISTarget[];
  localTargetCount: number;
  internetTargetCount: number;
  internetConfigured: boolean;
  internetConnected: boolean;
  internetError: string | null;
}

export interface TrackRecorderStatus {
  recording: boolean;
  trackId: string | null;
  startedAt: number | null;
  pointCount: number | null;
  error: string | null;
}

export interface TrackSummary {
  id: string;
  startedAt: number;
  endedAt: number | null;
  pointCount: number;
  sizeBytes: number;
}

export interface TracksResponse {
  recorder: TrackRecorderStatus;
  tracks: TrackSummary[];
  stopped?: TrackSummary | null;
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

export interface RoutingPolarSummary {
  id: string;
  name: string;
}

export interface RoutingPlan {
  useCurrentPosition: boolean;
  startPosition: Position | null;
  finishPosition: Position | null;
  polarId: string | null;
  /**
   * Seuil de relais moteur B1 (#133) : sous cette vitesse voile (SOG polaire,
   * noeuds), le tronçon passe en moteur a 4.0 kt. Defaut 2.0 ; null = pur
   * voile (pas de relais, back-compat moteur).
   */
  engineBelowKts: number | null;
}

/**
 * Echo du repli constant dérivé par le serveur (autorité vent, C2/#102/#103).
 * null quand le GRIB sert au calcul — le client n'envoie plus de vent.
 */
export interface RoutingWindInput {
  directionFromDeg: number;
  speedKts: number;
}

/** GeoJSON produit par to_geojson() : LineString [lon, lat] du départ à l'arrivée. */
export interface RoutingRouteGeoJson {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: {
      type: 'LineString';
      coordinates: [number, number][];
    };
    properties: Record<string, unknown>;
  }>;
}

/** Réponse de POST /api/grib/download et GET /api/grib/status (issue #16). */
export interface GribBounds {
  south: number;
  north: number;
  west: number;
  east: number;
}

export interface GribStatus {
  available: boolean;
  fresh: boolean;
  reason: string | null;
  createdAt: number | null;
  validUntil: number | null;
  south: number | null;
  north: number | null;
  west: number | null;
  east: number | null;
  resolutionDeg: number | null;
  stepH: number | null;
  points: number | null;
  steps: number | null;
}

/** Rapprochement d'un point demandé vers l'eau la plus proche (point classé « à terre »). */
export interface RoutingRouteAdjustment {
  latitude: number;
  longitude: number;
  offsetNm: number;
}

/** Réponse de POST /api/routing/compute (issue #17). */
export interface RoutingRouteResult {
  found: boolean;
  coords: [number, number][];
  etaS: number;
  dtS: number;
  minDistNm: number;
  message: string | null;
  geojson: RoutingRouteGeoJson | null;
  windSource: 'grib' | 'constant';
  /** Vent au depart tel qu'utilise par le calcul (#135) : echo du champ GRIB
   * echantillonne quand la source est GRIB ; vent du plan en constant. */
  wind: RoutingWindInput | null;
  /** Moyenne VECTORIELLE du vent le long de la route (#135) : direction
   * issue des composantes u/v moyennes (jamais arithmetique des degres). */
  windAvg?: RoutingWindInput | null;
  polarId: string;
  start: Position;
  finish: Position;
  /** SOG (noeuds) et temps cumules (s) a chaque point du trace (issue #18) :
   *  convention moteur — len == len(coords), timesS[0] = 0, timesS[last] = etaS,
   *  sogKts[j] = vitesse d'arrivee au point j (sogKts[0] artificiel, patche moteur). */
  timesS?: number[];
  sogKts?: number[];
  /**
   * B1 (#133) : flags moteur par point — meme convention moteur que sogKts
   * (#123) : len == len(coords), entree j = troncon d'arrivee au point j
   * (index 0 artificiel, miroir du troncon 1). Null = pur voile.
   * engineBelowKts = echo du seuil effectif du plan (null = pur voile).
   */
  motorFlags?: boolean[] | null;
  engineBelowKts?: number | null;
  /**
   * #141 : true = depart couvert par le champ GRIB ; false = depart hors
   * zone — le moteur nearest-clippe silencieusement (vent du bord de
   * grille) et le panneau affiche un avertissement ; null/absent = vent
   * sans emprise connue (ex. constant) ou information indisponible.
   */
  startInGrib?: boolean | null;
  startAdjusted?: RoutingRouteAdjustment | null;
  finishAdjusted?: RoutingRouteAdjustment | null;
}

/** Statut d'un job de routage asynchrone (issue #96). */
export type RoutingJobStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

/**
 * Progression brute remontée par le serveur (~1 Hz pendant le calcul) :
 * elapsed en secondes, explored_nodes et timings des phases — aucun
 * pourcentage n'est calculé côté front.
 */
export interface RoutingJobProgress {
  elapsed: number;
  explored_nodes: number;
  phases: Record<string, number>;
}

/**
 * Résultat d'un job terminé : payload complet de l'ancien
 * POST /api/routing/compute, plus timings et params effectifs (règle D3).
 */
export interface RoutingJobResult extends RoutingRouteResult {
  timings?: Record<string, number>;
  params?: { dt_s: number; bin_deg: number };
}

/** Snapshot d'un job : GET /api/routing/jobs/{jobId} et DELETE (issue #96). */
export interface RoutingJob {
  jobId: string;
  status: RoutingJobStatus;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  progress?: RoutingJobProgress;
  result?: RoutingJobResult;
  error?: string;
}

/** Réponse 202 de POST /api/routing/jobs (issue #96). */
export interface RoutingJobAccepted {
  jobId: string;
}
