import React from "react";
import { AlertTriangle, Radio, ShieldAlert, Navigation } from "lucide-react";
import type { NavEvent, RoadHazard } from "../types.js";

interface EventLogProps {
  events: NavEvent[];
  hazards: RoadHazard[];
}

export const EventLog: React.FC<EventLogProps> = ({ events, hazards }) => {
  return (
    <div className="glass-panel p-5 w-96 flex flex-col gap-4 select-none max-h-[500px]">
      <div className="border-b border-slate-700/60 pb-3 flex items-center justify-between">
        <div>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Integrity Stream</span>
          <div className="text-sm font-extrabold text-white">Security, Hazards & Outages</div>
        </div>
        <span className="text-[10px] bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-slate-300 mono">
          {events.length} events
        </span>
      </div>

      <div className="flex flex-col gap-2 overflow-y-auto pr-1">
        {events.map((ev, idx) => {
          let icon = <Radio className="w-4 h-4 text-cyan-400" />;
          let borderStyle = "border-slate-800 bg-slate-900/60";

          if (ev.type.includes("JAMMING") || ev.type.includes("SPOOF")) {
            icon = <ShieldAlert className="w-4 h-4 text-rose-400" />;
            borderStyle = "border-rose-500/40 bg-rose-950/30 text-rose-200";
          } else if (ev.type === "TUNNEL_AHEAD" || ev.type === "DR") {
            icon = <Navigation className="w-4 h-4 text-amber-400" />;
            borderStyle = "border-amber-500/40 bg-amber-950/30 text-amber-200";
          }

          return (
            <div key={idx} className={`p-2.5 rounded-lg border flex items-start gap-2.5 text-xs ${borderStyle}`}>
              <div className="mt-0.5">{icon}</div>
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold tracking-wide">{ev.type}</span>
                  <span className="text-[10px] text-slate-400 mono">
                    {new Date(ev.t_ms).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Device <span className="mono font-semibold text-slate-300">{ev.device_id}</span>
                </div>
                {ev.details && (
                  <div className="text-[10px] text-slate-400/90 mt-1 bg-black/30 p-1.5 rounded font-mono">
                    {JSON.stringify(ev.details)}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {hazards.map((hz, idx) => (
          <div key={`hz-${idx}`} className="p-2.5 rounded-lg border border-amber-900/50 bg-amber-950/20 text-amber-200 flex items-start gap-2.5 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5" />
            <div className="flex-1">
              <div className="flex justify-between items-center">
                <span className="font-bold">{hz.kind} DETECTED</span>
                <span className="text-[10px] text-slate-400 mono">{new Date(hz.t_ms).toLocaleTimeString()}</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Severity: <span className="mono font-bold text-amber-300">{hz.severity.toFixed(1)}g</span> anomaly
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
