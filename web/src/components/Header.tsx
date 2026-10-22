import React from "react";
import {
  Radio,
  Layers,
  Activity,
  AlertTriangle,
  Smartphone,
  Map,
  Download,
} from "lucide-react";

interface HeaderProps {
  activeView: "live" | "replay" | "events";
  onViewChange: (view: "live" | "replay" | "events") => void;
  activeVehiclesCount: number;
  onOpenSimulator: () => void;
  onOpenMapPacks: () => void;
  onOpenApkModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  onViewChange,
  activeVehiclesCount,
  onOpenSimulator,
  onOpenMapPacks,
  onOpenApkModal,
}) => {
  return (
    <header className="glass-panel mx-3 mt-3 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 z-10 select-none">
      {/* Left Logo & Info */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400 font-bold">
          <Radio className="w-4 h-4 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold tracking-wide text-base text-white">IDR 26168</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold">
              ISRO PS 26168
            </span>
          </div>
          <p className="text-[11px] text-slate-400 hidden sm:block">
            Intelligent Dead Reckoning Navigation & Fleet Dispatch
          </p>
        </div>
      </div>

      {/* Center View Controls */}
      <div className="flex items-center bg-slate-900/80 p-1 rounded-xl border border-slate-700/60">
        <button
          onClick={() => onViewChange("live")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeView === "live"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Fleet ({activeVehiclesCount})</span>
        </button>

        <button
          onClick={() => onViewChange("replay")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeView === "replay"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Replay & Benchmarks</span>
        </button>

        <button
          onClick={() => onViewChange("events")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeView === "events"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Integrity & Hazards</span>
        </button>
      </div>

      {/* Right Primary Actions */}
      <div className="flex items-center gap-2">
        {/* Device Cockpit Simulator Button */}
        <button
          onClick={onOpenSimulator}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600/30 to-blue-600/30 hover:from-cyan-600/50 hover:to-blue-600/50 border border-cyan-500/40 text-cyan-200 text-xs font-bold transition-all shadow-sm"
        >
          <Smartphone className="w-3.5 h-3.5 text-cyan-300" />
          <span>Phone Simulator</span>
        </button>

        {/* India Maps Store Button */}
        <button
          onClick={onOpenMapPacks}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs font-bold transition-all"
        >
          <Map className="w-3.5 h-3.5 text-amber-400" />
          <span>India Maps</span>
        </button>

        {/* Download APK / App Button */}
        <button
          onClick={onOpenApkModal}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black transition-all shadow-md shadow-cyan-950/40"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download App</span>
        </button>
      </div>
    </header>
  );
};
