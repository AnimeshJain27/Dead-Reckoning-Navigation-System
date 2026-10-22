import { api } from "../api/client.js";
import type { DeviceTelemetry, NavMode } from "../types.js";

export interface RawSensorData {
  accel: { x: number; y: number; z: number };
  gyro: { x: number; y: number; z: number };
  orientation: { alpha: number; beta: number; gamma: number }; // alpha=compass heading, beta=pitch, gamma=roll
  gnss: {
    lat: number;
    lon: number;
    accuracy_m: number;
    speed_mps: number;
    heading_deg: number;
    timestamp: number;
  } | null;
  hasMotion: boolean;
  hasOrientation: boolean;
  hasGnss: boolean;
}

export type SensorListener = (sensors: RawSensorData, telemetry: DeviceTelemetry) => void;

class MobileSensorService {
  private active = false;
  private watchId: number | null = null;
  private listeners: SensorListener[] = [];
  private deviceId = `PHONE_${Math.floor(1000 + Math.random() * 9000)}`;
  private tripId = `TRIP_LIVE_${Date.now().toString(36)}`;

  // Sensor states
  private currentSensors: RawSensorData = {
    accel: { x: 0, y: 0, z: 0 },
    gyro: { x: 0, y: 0, z: 0 },
    orientation: { alpha: 0, beta: 0, gamma: 0 },
    gnss: null,
    hasMotion: false,
    hasOrientation: false,
    hasGnss: false,
  };

  // Dead reckoning internal state
  private state = {
    lat: 19.0220, // Default to Mumbai Eastern Freeway corridor
    lon: 72.8755,
    speed_mps: 0,
    heading_deg: 24.5,
    mode: "GNSS_OK" as NavMode,
    hpl_m: 3.2,
    lastUpdateMs: Date.now(),
    outageActive: false,
    outageStartMs: 0,
    drDistanceM: 0,
  };

  private motionHandler = (e: DeviceMotionEvent) => {
    this.currentSensors.hasMotion = true;
    const acc = e.acceleration || e.accelerationIncludingGravity;
    if (acc) {
      this.currentSensors.accel = {
        x: Math.round((acc.x || 0) * 100) / 100,
        y: Math.round((acc.y || 0) * 100) / 100,
        z: Math.round((acc.z || 0) * 100) / 100,
      };
    }
    if (e.rotationRate) {
      this.currentSensors.gyro = {
        x: Math.round((e.rotationRate.alpha || 0) * 100) / 100,
        y: Math.round((e.rotationRate.beta || 0) * 100) / 100,
        z: Math.round((e.rotationRate.gamma || 0) * 100) / 100,
      };
    }
    this.onSensorTick();
  };

  private orientationHandler = (e: DeviceOrientationEvent) => {
    this.currentSensors.hasOrientation = true;
    this.currentSensors.orientation = {
      alpha: Math.round((e.alpha || 0) * 10) / 10,
      beta: Math.round((e.beta || 0) * 10) / 10,
      gamma: Math.round((e.gamma || 0) * 10) / 10,
    };
    if (e.alpha !== null && !this.state.outageActive) {
      this.state.heading_deg = e.alpha;
    }
  };

  private gnssSuccessHandler = (pos: GeolocationPosition) => {
    this.currentSensors.hasGnss = true;
    const speed = pos.coords.speed !== null && !isNaN(pos.coords.speed) ? pos.coords.speed : 0;
    const heading = pos.coords.heading !== null && !isNaN(pos.coords.heading) ? pos.coords.heading : this.state.heading_deg;

    this.currentSensors.gnss = {
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      accuracy_m: pos.coords.accuracy || 4.0,
      speed_mps: speed,
      heading_deg: heading,
      timestamp: pos.timestamp,
    };

    if (!this.state.outageActive) {
      this.state.lat = pos.coords.latitude;
      this.state.lon = pos.coords.longitude;
      this.state.speed_mps = speed;
      this.state.heading_deg = heading;
      this.state.hpl_m = Math.max(2.5, pos.coords.accuracy * 0.8);
      this.state.mode = pos.coords.accuracy > 15 ? "DEGRADED" : "GNSS_OK";
    }
    this.onSensorTick();
  };

  private gnssErrorHandler = (err: GeolocationPositionError) => {
    console.warn("[MobileSensorService] Geolocation error:", err.message);
  };

  /**
   * Request permissions (required on iOS Safari 13+) and start listening
   */
  async start(): Promise<boolean> {
    if (this.active) return true;

    // Check iOS DeviceOrientation permission
    if (typeof (DeviceOrientationEvent as any)?.requestPermission === "function") {
      try {
        const response = await (DeviceOrientationEvent as any).requestPermission();
        if (response !== "granted") {
          console.warn("DeviceOrientation permission denied");
        }
      } catch (err) {
        console.warn("Permission request failed", err);
      }
    }

    if (typeof (DeviceMotionEvent as any)?.requestPermission === "function") {
      try {
        const response = await (DeviceMotionEvent as any).requestPermission();
        if (response !== "granted") {
          console.warn("DeviceMotion permission denied");
        }
      } catch (err) {
        console.warn("Permission request failed", err);
      }
    }

    if (typeof window !== "undefined") {
      window.addEventListener("devicemotion", this.motionHandler, true);
      window.addEventListener("deviceorientation", this.orientationHandler, true);

      if ("geolocation" in navigator) {
        this.watchId = navigator.geolocation.watchPosition(
          this.gnssSuccessHandler,
          this.gnssErrorHandler,
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 500,
          }
        );
      }
    }

    this.active = true;
    this.state.lastUpdateMs = Date.now();
    return true;
  }

  stop() {
    if (!this.active) return;
    if (typeof window !== "undefined") {
      window.removeEventListener("devicemotion", this.motionHandler, true);
      window.removeEventListener("deviceorientation", this.orientationHandler, true);
      if (this.watchId !== null) {
        navigator.geolocation.clearWatch(this.watchId);
        this.watchId = null;
      }
    }
    this.active = false;
  }

  setOutage(active: boolean) {
    this.state.outageActive = active;
    if (active) {
      this.state.outageStartMs = Date.now();
      this.state.mode = "DR";
      this.state.drDistanceM = 0;
    } else {
      this.state.mode = "GNSS_OK";
      this.state.hpl_m = 3.2;
    }
    this.onSensorTick();
  }

  isOutageActive(): boolean {
    return this.state.outageActive;
  }

  setSpeed(speedKmh: number) {
    this.state.speed_mps = speedKmh / 3.6;
    this.onSensorTick();
  }

  setHeading(headingDeg: number) {
    this.state.heading_deg = (headingDeg + 360) % 360;
    this.onSensorTick();
  }

  setCoordinates(lat: number, lon: number) {
    this.state.lat = lat;
    this.state.lon = lon;
    this.onSensorTick();
  }

  getDeviceId(): string {
    return this.deviceId;
  }

  subscribe(listener: SensorListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private lastIngestMs = 0;

  private onSensorTick() {
    const now = Date.now();
    const dt = Math.max(0.02, Math.min(0.5, (now - this.state.lastUpdateMs) / 1000));
    this.state.lastUpdateMs = now;

    // If in Outage / Dead Reckoning mode, propagate position using dead reckoning physics
    if (this.state.outageActive) {
      // Gyro yaw integration if rotation rate is present
      if (this.currentSensors.gyro.z !== 0) {
        this.state.heading_deg = (this.state.heading_deg + this.currentSensors.gyro.z * dt + 360) % 360;
      }

      // If phone is stationary / speed is small
      const stepDistM = this.state.speed_mps * dt;
      this.state.drDistanceM += stepDistM;

      // Geodesic dead reckoning translation (WGS84 spherical approx)
      const headingRad = (this.state.heading_deg * Math.PI) / 180.0;
      const dLat = (stepDistM * Math.cos(headingRad)) / 111132.95;
      const dLon = (stepDistM * Math.sin(headingRad)) / (111132.95 * Math.cos((this.state.lat * Math.PI) / 180.0));

      this.state.lat += dLat;
      this.state.lon += dLon;

      // Protection Level growth: HPL(t) = HPL0 + 0.035 * dist + drift_sigma
      this.state.hpl_m = Math.min(25.0, 3.4 + 0.035 * this.state.drDistanceM + ((now - this.state.outageStartMs) / 1000) * 0.08);
      this.state.mode = this.state.hpl_m > 18.0 ? "SUSPECT_RF" : "DR";
    }

    const telemetry: DeviceTelemetry = {
      device_id: this.deviceId,
      trip_id: this.tripId,
      t_ms: now,
      lat: this.state.lat,
      lon: this.state.lon,
      speed_mps: Math.round(this.state.speed_mps * 10) / 10,
      speed_kmh: Math.round(this.state.speed_mps * 3.6 * 10) / 10,
      heading_deg: Math.round(this.state.heading_deg * 10) / 10,
      mode: this.state.mode,
      hpl_m: Math.round(this.state.hpl_m * 10) / 10,
      ell_major_m: Math.round(this.state.hpl_m * 10) / 10,
      ell_minor_m: Math.round(this.state.hpl_m * 0.6 * 10) / 10,
      ell_angle_deg: Math.round(this.state.heading_deg),
      vehicle_mode: "CAR",
      way_id: this.state.outageActive ? 1002 : 1001,
    };

    // Notify UI listeners
    for (const listener of this.listeners) {
      listener(this.currentSensors, telemetry);
    }

    // Rate-limit backend ingestion to ~2 Hz (every 500ms)
    if (now - this.lastIngestMs > 500) {
      this.lastIngestMs = now;
      api.ingestTelemetry({
        device_id: this.deviceId,
        trip_id: this.tripId,
        states: [
          {
            t_ms: now,
            lat: telemetry.lat,
            lon: telemetry.lon,
            speed_mps: telemetry.speed_mps,
            heading_deg: telemetry.heading_deg,
            mode: telemetry.mode,
            hpl_m: telemetry.hpl_m,
            ell_major_m: telemetry.ell_major_m,
            ell_minor_m: telemetry.ell_minor_m,
            ell_angle_deg: telemetry.ell_angle_deg,
            way_id: telemetry.way_id,
            vehicle_mode: telemetry.vehicle_mode,
          },
        ],
      });
    }
  }
}

export const mobileSensors = new MobileSensorService();
