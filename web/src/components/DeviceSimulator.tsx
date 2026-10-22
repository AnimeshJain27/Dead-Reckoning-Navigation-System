import React, { useState, useEffect, useRef } from "react";
import {
  Shield,
  Activity,
  Radio,
  MapPin,
  RotateCcw,
  Sliders,
  AlertTriangle,
} from "lucide-react";
import { mobileSensors, RawSensorData } from "../services/mobileSensorService.js";
import type { DeviceTelemetry } from "../types.js";

interface DeviceSimulatorProps {
  onClose?: () => void;
  onSelectVehicle?: (deviceId: string) => void;
}

export const DeviceSimulator: React.FC<DeviceSimulatorProps> = ({ onClose, onSelectVehicle }) => {
  const [mode, setMode] = useState<"live_sensors" | "cockpit_sim">("cockpit_sim");
  const [sensors, setSensors] = useState<RawSensorData>({
    accel: { x: 0, y: 0, z: 9.81 },
    gyro: { x: 0, y: 0, z: 0 },
    orientation: { alpha: 24.5, beta: 0, gamma: 0 },
    gnss: null,
    hasMotion: false,
    hasOrientation: false,
    hasGnss: false,
  });

  const [telemetry, setTelemetry] = useState<DeviceTelemetry>({
    device_id: mobileSensors.getDeviceId(),
    trip_id: "TRIP_SIM_01",
    t_ms: Date.now(),
    lat: 19.0220,
    lon: 72.8755,
    speed_mps: 16.7,
    speed_kmh: 60.0,
    heading_deg: 24.5,
    mode: "GNSS_OK",
    hpl_m: 3.2,
    ell_major_m: 3.2,
    ell_minor_m: 2.1,
    ell_angle_deg: 24.5,
    vehicle_mode: "CAR",
    way_id: 1001,
  });

  const [simSpeedKmh, setSimSpeedKmh] = useState(65);
  const [simHeadingDeg, setSimHeadingDeg] = useState(25);
  const [isOutage, setIsOutage] = useState(false);
  const [outageSeconds, setOutageSeconds] = useState(0);
  const [selectedCorridor, setSelectedCorridor] = useState<string>("mumbai");
  const timerRef = useRef<any>(null);

  // Corridor presets
  const corridors: Record<string, { name: string; tunnel: string; lat: number; lon: number; heading: number }> = {
    mumbai: {
      name: "Mumbai Eastern Freeway",
      tunnel: "Anik Tunnel (510 m)",
      lat: 19.0220,
      lon: 72.8755,
      heading: 25,
    },
    delhi: {
      name: "Delhi Ring Road Corridor",
      tunnel: "Pragati Maidan Tunnel (1.3 km)",
      lat: 28.6180,
      lon: 77.2450,
      heading: 105,
    },
    bengaluru: {
      name: "Bengaluru Outer Ring Road",
      tunnel: "Majestic Transit Tunnel (1.1 km)",
      lat: 12.9770,
      lon: 77.5720,
      heading: 180,
    },
    khandala: {
      name: "NH-48 Mumbai-Pune Expressway",
      tunnel: "Bhor Ghat Khandala Tunnel (1.8 km)",
      lat: 18.7750,
      lon: 73.3420,
      heading: 142,
    },
  };

  useEffect(() => {
    mobileSensors.start();
    mobileSensors.setSpeed(simSpeedKmh);
    mobileSensors.setHeading(simHeadingDeg);

    const unsubscribe = mobileSensors.subscribe((raw, telem) => {
      setSensors(raw);
      setTelemetry(telem);
    });

    return () => {
      unsubscribe();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Outage counter
  useEffect(() => {
    if (isOutage) {
      setOutageSeconds(0);
      timerRef.current = setInterval(() => {
        setOutageSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setOutageSeconds(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOutage]);

  const handleToggleOutage = () => {
    const nextState = !isOutage;
    setIsOutage(nextState);
    mobileSensors.setOutage(nextState);
  };

  const handleCorridorChange = (key: string) => {
    setSelectedCorridor(key);
    const c = corridors[key];
    if (c) {
      setSimHeadingDeg(c.heading);
      mobileSensors.setHeading(c.heading);
      mobileSensors.setCoordinates(c.lat, c.lon);
    }
  };

  const handleSpeedSlider = (val: number) => {
    setSimSpeedKmh(val);
    mobileSensors.setSpeed(val);
  };

  const handleSteer = (deltaDeg: number) => {
    const next = (simHeadingDeg + deltaDeg + 360) % 360;
    setSimHeadingDeg(next);
    mobileSensors.setHeading(next);
  };

  const requestSensors = async () => {
    await mobileSensors.start();
  };

  return (
    <div className="flex flex-col xl:flex-row items-center justify-center gap-8 max-w-5xl mx-auto p-4 select-none">
      {/* ============================================================ */}
      {/* PHYSICAL SMARTPHONE CHASSIS                                 */}
      {/* ============================================================ */}
      <div className="relative w-[340px] h-[690px] bg-slate-900 rounded-[50px] p-3 shadow-2xl border-[5px] border-slate-700/80 shadow-cyan-950/40 ring-1 ring-white/10 flex flex-col justify-between overflow-hidden">
        {/* Gloss overlay */}
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-gradient-to-br from-white/10 to-transparent rounded-full pointer-events-none blur-xl" />

        {/* Dynamic Island / Speaker Pill */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-full z-30 flex items-center justify-between px-3">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-cyan-400" />
          </div>
          <div className="w-10 h-1 bg-slate-800 rounded-full" />
        </div>

        {/* Screen Bezel & Screen Area */}
        <div className="relative w-full h-full bg-slate-950 rounded-[40px] overflow-hidden flex flex-col pt-8 pb-3 px-3.5 border border-slate-800/80">
          {/* Top Status Bar */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-2 mb-2 font-mono">
            <span>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-cyan-300 font-bold">5G / NavIC</span>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 gap-1 bg-slate-900/90 p-1 rounded-xl mb-3 border border-slate-800">
            <button
              onClick={() => setMode("cockpit_sim")}
              className={`py-1 text-[11px] font-bold rounded-lg transition-all ${
                mode === "cockpit_sim"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Cockpit HUD
            </button>
            <button
              onClick={() => {
                setMode("live_sensors");
                requestSensors();
              }}
              className={`py-1 text-[11px] font-bold rounded-lg transition-all ${
                mode === "live_sensors"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Phone IMU Feed
            </button>
          </div>

          {/* ============================================================ */}
          {/* SCREEN CONTENT: COCKPIT HUD MODE                             */}
          {/* ============================================================ */}
          {mode === "cockpit_sim" && (
            <div className="flex-1 flex flex-col justify-between gap-2 overflow-y-auto pr-0.5">
              {/* Navigation Status Banner */}
              <div
                className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                  isOutage
                    ? "bg-amber-500/15 border-amber-500/50 text-amber-300 animate-pulse"
                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  <div>
                    <div className="text-xs font-black tracking-wide">
                      {isOutage ? `DEAD RECKONING (${outageSeconds}s)` : "GNSS POSITION FIXED"}
                    </div>
                    <div className="text-[9px] text-slate-300 opacity-80">
                      {isOutage ? "IMU Step-TCN + Yaw Integrator Active" : "Dual-Freq NavIC L5 / GPS L1"}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40 font-bold">
                  {telemetry.mode}
                </span>
              </div>

              {/* Digital Speedometer & Attitude Indicator */}
              <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800/80 flex flex-col items-center relative overflow-hidden">
                <div className="w-full flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase mb-1">
                  <span>Velocity</span>
                  <span>Heading {Math.round(telemetry.heading_deg)}°</span>
                </div>

                {/* Big Speed Dial */}
                <div className="flex items-baseline gap-1 my-1">
                  <span className="text-5xl font-black text-white font-mono tracking-tighter">
                    {telemetry.speed_kmh}
                  </span>
                  <span className="text-xs text-cyan-400 font-bold uppercase">km/h</span>
                </div>

                {/* Speed Progress Bar */}
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden mb-2">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-200"
                    style={{ width: `${Math.min(100, (telemetry.speed_kmh / 120) * 100)}%` }}
                  />
                </div>

                {/* Mini Artificial Horizon Attitude Bar */}
                <div className="w-full h-10 bg-slate-950/90 rounded-xl border border-slate-800 relative flex items-center justify-center overflow-hidden">
                  {/* Sky/Ground line tilted by Roll */}
                  <div
                    className="absolute w-40 h-0.5 bg-cyan-400/70 transition-transform duration-100"
                    style={{
                      transform: `rotate(${sensors.orientation.gamma}deg) translateY(${sensors.orientation.beta}px)`,
                    }}
                  />
                  <div className="w-3 h-3 border-2 border-amber-400 rounded-full z-10" />
                  <span className="absolute left-2 text-[9px] text-slate-500 font-mono">
                    Pitch {sensors.orientation.beta}°
                  </span>
                  <span className="absolute right-2 text-[9px] text-slate-500 font-mono">
                    Roll {sensors.orientation.gamma}°
                  </span>
                </div>
              </div>

              {/* Protection Level & Integrity Gauge */}
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-400 text-[10px] font-bold flex items-center gap-1">
                    <Shield className="w-3 h-3 text-cyan-400" /> HPL Bound (3.72σ)
                  </span>
                  <span className="font-mono font-bold text-cyan-300 text-xs">{telemetry.hpl_m.toFixed(1)} m</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      telemetry.hpl_m > 18.0 ? "bg-rose-500" : telemetry.hpl_m > 10.0 ? "bg-amber-500" : "bg-cyan-500"
                    }`}
                    style={{ width: `${Math.min(100, (telemetry.hpl_m / 20.0) * 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[9px] text-slate-500 mt-1">
                  <span>0 m</span>
                  <span>Alert Limit (20 m)</span>
                </div>
              </div>

              {/* Outage Toggle Action Button */}
              <button
                onClick={handleToggleOutage}
                className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md ${
                  isOutage
                    ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/50"
                    : "bg-amber-600 hover:bg-amber-500 text-slate-950 font-extrabold shadow-amber-900/40"
                }`}
              >
                {isOutage ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin" /> RESTORE GNSS SIGNAL
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4" /> ENTER TUNNEL / DROP GNSS
                  </>
                )}
              </button>

              {/* Waypoint & Coordinates */}
              <div className="bg-slate-900/50 p-2 rounded-xl border border-slate-800/60 text-[10px] font-mono text-slate-400 flex items-center justify-between">
                <span>{telemetry.lat.toFixed(5)}°N, {telemetry.lon.toFixed(5)}°E</span>
                <span className="text-cyan-400 font-bold">Way #{telemetry.way_id || 1001}</span>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* SCREEN CONTENT: LIVE SENSOR IMU FEED MODE                    */}
          {/* ============================================================ */}
          {mode === "live_sensors" && (
            <div className="flex-1 flex flex-col justify-between gap-2 overflow-y-auto pr-0.5">
              <div className="bg-cyan-500/10 border border-cyan-500/30 p-2 rounded-xl text-[11px] text-cyan-300">
                <div className="font-bold mb-0.5 flex items-center gap-1">
                  <Radio className="w-3.5 h-3.5 animate-pulse" /> Live Mobile Sensor Engine
                </div>
                <p className="text-[10px] text-slate-400">
                  Streaming 6-DoF accelerometer + gyroscope + magnetometer into dead reckoning filter.
                </p>
              </div>

              {/* Accelerometer 3-Axis */}
              <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Accelerometer (m/s²)
                </span>
                <div className="grid grid-cols-3 gap-2 mt-1.5 text-center font-mono text-xs">
                  <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                    <div className="text-[9px] text-slate-500">X (Lat)</div>
                    <div className="text-slate-200 font-bold">{sensors.accel.x.toFixed(2)}</div>
                  </div>
                  <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                    <div className="text-[9px] text-slate-500">Y (Fwd)</div>
                    <div className="text-slate-200 font-bold">{sensors.accel.y.toFixed(2)}</div>
                  </div>
                  <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                    <div className="text-[9px] text-slate-500">Z (Vert)</div>
                    <div className="text-slate-200 font-bold">{sensors.accel.z.toFixed(2)}</div>
                  </div>
                </div>
              </div>

              {/* Gyroscope 3-Axis */}
              <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Gyroscope (°/s)
                </span>
                <div className="grid grid-cols-3 gap-2 mt-1.5 text-center font-mono text-xs">
                  <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                    <div className="text-[9px] text-slate-500">Roll (α)</div>
                    <div className="text-slate-200 font-bold">{sensors.gyro.x.toFixed(1)}</div>
                  </div>
                  <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                    <div className="text-[9px] text-slate-500">Pitch (β)</div>
                    <div className="text-slate-200 font-bold">{sensors.gyro.y.toFixed(1)}</div>
                  </div>
                  <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                    <div className="text-[9px] text-slate-500">Yaw (γ)</div>
                    <div className="text-cyan-400 font-bold">{sensors.gyro.z.toFixed(1)}</div>
                  </div>
                </div>
              </div>

              {/* Orientation & Heading */}
              <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Orientation Angles
                </span>
                <div className="grid grid-cols-3 gap-2 mt-1.5 text-center font-mono text-xs">
                  <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                    <div className="text-[9px] text-slate-500">Compass</div>
                    <div className="text-amber-400 font-bold">{sensors.orientation.alpha}°</div>
                  </div>
                  <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                    <div className="text-[9px] text-slate-500">Pitch</div>
                    <div className="text-slate-200 font-bold">{sensors.orientation.beta}°</div>
                  </div>
                  <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                    <div className="text-[9px] text-slate-500">Roll</div>
                    <div className="text-slate-200 font-bold">{sensors.orientation.gamma}°</div>
                  </div>
                </div>
              </div>

              {/* Geolocation Hardware Fix */}
              <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 text-[11px]">
                <div className="flex items-center justify-between text-slate-400 font-bold uppercase text-[10px] mb-1">
                  <span>Phone GNSS Chip</span>
                  <span className={sensors.hasGnss ? "text-emerald-400" : "text-amber-400"}>
                    {sensors.hasGnss ? "FIX ACQUIRED" : "SEARCHING..."}
                  </span>
                </div>
                {sensors.gnss ? (
                  <div className="font-mono text-[10px] text-slate-300">
                    <div>Coord: {sensors.gnss.lat.toFixed(6)}, {sensors.gnss.lon.toFixed(6)}</div>
                    <div>Accuracy: ±{sensors.gnss.accuracy_m.toFixed(1)} m | Speed: {(sensors.gnss.speed_mps * 3.6).toFixed(1)} km/h</div>
                  </div>
                ) : (
                  <button
                    onClick={requestSensors}
                    className="w-full py-1.5 mt-1 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 rounded-lg text-cyan-200 text-xs font-bold"
                  >
                    Enable Mobile GPS & IMU
                  </button>
                )}
              </div>

              {/* Ingestion Info */}
              <div className="text-[9px] text-slate-500 text-center mono">
                Broadcasting as {telemetry.device_id} to Dispatch
              </div>
            </div>
          )}

          {/* Bottom Home Indicator Bar */}
          <div className="w-28 h-1 bg-slate-600 rounded-full mx-auto mt-2" />
        </div>
      </div>

      {/* ============================================================ */}
      {/* DESKTOP SIMULATOR CONTROL DECK                               */}
      {/* ============================================================ */}
      <div className="flex-1 glass-panel p-6 max-w-lg flex flex-col gap-4">
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-cyan-400" /> Physical Device Simulator
            </h3>
            {onClose && (
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition-all"
              >
                Close Deck
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Simulate an in-vehicle smartphone running IDR 26168 or test real-time mobile sensor feeds.
          </p>
        </div>

        {/* Corridor Selection */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wide">
            Select Indian Tunnel Corridor:
          </label>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(corridors).map(([key, val]) => (
              <button
                key={key}
                onClick={() => handleCorridorChange(key)}
                className={`p-2 rounded-xl text-left border transition-all text-xs ${
                  selectedCorridor === key
                    ? "bg-cyan-500/20 border-cyan-500/60 text-cyan-200 shadow-sm"
                    : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                <div className="font-bold text-white text-[11px] truncate">{val.name}</div>
                <div className="text-[10px] text-cyan-400/80 truncate">{val.tunnel}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Driving Controls (Speed & Steering) */}
        <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 flex flex-col gap-3">
          {/* Speed Slider */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-300 font-bold">Accelerator / Speed:</span>
              <span className="text-cyan-400 font-mono font-bold text-sm">{simSpeedKmh} km/h</span>
            </div>
            <input
              type="range"
              min="0"
              max="120"
              value={simSpeedKmh}
              onChange={(e) => handleSpeedSlider(parseInt(e.target.value, 10))}
              className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Steering Controls */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-300 font-bold">Steering / Yaw Angle:</span>
              <span className="text-amber-400 font-mono font-bold text-sm">{simHeadingDeg}°</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSteer(-15)}
                className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-all"
              >
                ◀ Turn Left (-15°)
              </button>
              <button
                onClick={() => handleSteer(15)}
                className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-all"
              >
                Turn Right (+15°) ▶
              </button>
            </div>
          </div>
        </div>

        {/* Outage Simulation Trigger */}
        <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">Outage Simulation:</span>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                isOutage ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "bg-emerald-500/20 text-emerald-300"
              }`}
            >
              {isOutage ? `Outage Active (${outageSeconds}s)` : "GNSS Normal"}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Cut GNSS reception to benchmark dead-reckoning trajectory drift and HPL inflation in real time.
          </p>
          <button
            onClick={handleToggleOutage}
            className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
              isOutage
                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                : "bg-amber-500 hover:bg-amber-400 text-slate-950 font-black"
            }`}
          >
            {isOutage ? "Restore Satellite Fix (GNSS)" : "Simulate Tunnel (Drop GNSS)"}
          </button>
        </div>

        {/* Focus on fleet map */}
        {onSelectVehicle && (
          <button
            onClick={() => onSelectVehicle(telemetry.device_id)}
            className="w-full py-2 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 rounded-xl text-cyan-300 text-xs font-bold flex items-center justify-center gap-2"
          >
            <MapPin className="w-4 h-4" /> Focus Device on Fleet Map
          </button>
        )}
      </div>
    </div>
  );
};
