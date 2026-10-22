import React from "react";
import { Gauge, Navigation, Shield, Compass, Car, Bike, CheckCircle2 } from "lucide-react";
import type { DeviceTelemetry } from "../types.js";

interface TelemetryPanelProps {
  telemetry: DeviceTelemetry | null;
}

export const TelemetryPanel: React.FC<TelemetryPanelProps> = ({ telemetry }) => {
  if (!telemetry) {
    return (
      <div className="glass-panel p-5 w-80 text-center text-slate-400 text-xs">
        Select a fleet vehicle to view real-time dead-reckoning telemetry.
      </div>
    );
  }

  const {
    device_id,
    speed_kmh,
    speed_mps,
    heading_deg,
    mode,
    hpl_m,
    ell_major_m,
    ell_minor_m,
    vehicle_mode,
    way_id,
  } = telemetry;

  // HPL ratio against 20.0 m Alert Limit
  const alertLimitM = 20.0;
  const hplPercent = Math.min(100, Math.round((hpl_m / alertLimitM) * 100));

  let badgeClass = "badge-gnss";
  let modeLabel = "GNSS OK";
  if (mode === "DR") {
    badgeClass = "badge-dr";
    modeLabel = "DEAD RECKONING";
  } else if (mode === "DEGRADED") {
    badgeClass = "badge-degraded";
    modeLabel = "GNSS DEGRADED";
  } else if (mode === "REACQ") {
    badgeClass = "badge-reacq";
    modeLabel = "RE-ACQUIRING";
  } else if (mode === "SUSPECT_RF") {
    badgeClass = "badge-suspect";
    modeLabel = "RF SPOOFING ALARM";
  }

  return (
    <div className="glass-panel p-5 w-84 flex flex-col gap-4 select-none">
      {/* Device Header & Mode */}
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
        <div>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Device ID</span>
          <div className="text-sm font-extrabold text-white mono">{device_id}</div>
        </div>
        <div className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${badgeClass} tracking-wide`}>
          {modeLabel}
        </div>
      </div>

      {/* Speedometer */}
      <div className="flex items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-white mono tracking-tight">{speed_kmh}</div>
            <div className="text-[10px] text-slate-400 font-semibold uppercase">km/h ({speed_mps.toFixed(1)} m/s)</div>
          </div>
        </div>

        {/* Heading */}
        <div className="flex items-center gap-2 text-right">
          <div>
            <div className="text-sm font-bold text-slate-200 mono">{Math.round(heading_deg)}°</div>
            <div className="text-[10px] text-slate-400">Heading</div>
          </div>
          <Compass className="w-5 h-5 text-slate-400" />
        </div>
      </div>

      {/* Horizontal Protection Level (HPL) */}
      <div className="flex flex-col gap-1.5 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span>Protection Level (HPL)</span>
          </div>
          <span className="text-xs font-bold text-cyan-300 mono">{hpl_m.toFixed(1)} m</span>
        </div>

        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              hpl_m > alertLimitM ? "bg-rose-500" : hpl_m > 12.0 ? "bg-amber-500" : "bg-cyan-500"
            }`}
            style={{ width: `${hplPercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span>0.0 m</span>
          <span>Alert Limit (20.0 m)</span>
        </div>

        <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
          <span>Error Ellipse:</span>
          <span className="mono text-slate-300">{ell_major_m.toFixed(1)}m × {ell_minor_m.toFixed(1)}m</span>
        </div>
      </div>

      {/* Vehicle Classification & Road Match */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 flex items-center gap-2">
          {vehicle_mode === "CAR" ? (
            <Car className="w-4 h-4 text-emerald-400" />
          ) : (
            <Bike className="w-4 h-4 text-amber-400" />
          )}
          <div>
            <div className="text-[10px] text-slate-400">Classifier</div>
            <div className="font-bold text-slate-200">{vehicle_mode}</div>
          </div>
        </div>

        <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 flex items-center gap-2">
          <Navigation className="w-4 h-4 text-cyan-400" />
          <div>
            <div className="text-[10px] text-slate-400">Matched Way</div>
            <div className="font-bold text-slate-200 mono">#{way_id || 1001}</div>
          </div>
        </div>
      </div>

      {/* Safety & Integrity Flags */}
      <div className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/80 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5 text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Mount Aligned (M1)</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
          <span>GLRT:</span>
          <span className="text-cyan-300 font-semibold">{speed_mps < 0.2 ? "STOPPED" : "MOVING"}</span>
        </div>
      </div>
    </div>
  );
};
