export type NavMode = "GNSS_OK" | "DEGRADED" | "DR" | "REACQ" | "SUSPECT_RF";
export type VehicleClass = "CAR" | "TWO_WHEELER";

export interface DeviceTelemetry {
  device_id: string;
  trip_id: string;
  t_ms: number;
  lat: number;
  lon: number;
  speed_mps: number;
  speed_kmh: number;
  heading_deg: number;
  mode: NavMode;
  hpl_m: number;
  ell_major_m: number;
  ell_minor_m: number;
  ell_angle_deg: number;
  vehicle_mode: VehicleClass;
  way_id?: number;
  level?: number;
}

export interface NavEvent {
  id?: number;
  device_id: string;
  trip_id?: string;
  t_ms: number;
  type: string;
  lat?: number;
  lon?: number;
  details?: Record<string, any>;
}

export interface RoadHazard {
  id?: number;
  device_id: string;
  t_ms: number;
  lat: number;
  lon: number;
  kind: "POTHOLE" | "SPEED_BREAKER";
  severity: number;
}

export interface TripSummary {
  id: string;
  device_id: string;
  device_name?: string;
  started_at: number;
  ended_at?: number;
  distance_m: number;
  dr_distance_m: number;
  max_hpl_m: number;
  vehicle_mode: VehicleClass;
}
