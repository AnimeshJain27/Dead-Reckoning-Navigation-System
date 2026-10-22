import React from "react";
import {
  Radio,
  Layers,
  Activity,
  AlertTriangle,
  Smartphone,
  Map,
  Download,
  Sun,
  Moon,
  BarChart2,
} from "lucide-react";

interface HeaderProps {
  activeView: "live" | "replay" | "events";
  onViewChange: (view: "live" | "replay" | "events") => void;
  activeVehiclesCount: number;
  onOpenSimulator: () => void;
  onOpenMapPacks: () => void;
  onOpenApkModal: () => void;
  onOpenModelPerformance: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  onViewChange,
  activeVehiclesCount,
  onOpenSimulator,
  onOpenMapPacks,
  onOpenApkModal,
  onOpenModelPerformance,
  theme,
  onToggleTheme,
}) => {
  const isLight = theme === "light";

  return (
    <header
      className={`mx-3 mt-3 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 z-10 select-none rounded-2xl border transition-all ${
        isLight
          ? "bg-white/95 text-slate-900 border-slate-200/90 shadow-lg shadow-slate-200/50"
          : "glass-panel text-white border-slate-700/70 shadow-2xl"
      }`}
    >
      {/* Left Logo & Info */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-500 font-bold">
          <Radio className="w-4 h-4 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className={`font-extrabold tracking-wide text-base ${isLight ? "text-slate-900" : "text-white"}`}>
              IDR 26168
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/40 text-cyan-600 dark:text-cyan-300 font-bold">
              ISRO PS 26168
            </span>
          </div>
          <p className={`text-[11px] hidden sm:block ${isLight ? "text-slate-500" : "text-slate-400"}`}>
            Intelligent Dead Reckoning Navigation & Fleet Dispatch
          </p>
        </div>
      </div>

      {/* Center View Controls */}
      <div
        className={`flex items-center p-1 rounded-xl border ${
          isLight ? "bg-slate-100 border-slate-200" : "bg-slate-900/80 border-slate-700/60"
        }`}
      >
        <button
          onClick={() => onViewChange("live")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeView === "live"
              ? isLight
                ? "bg-white text-cyan-700 border border-slate-200 shadow-sm"
                : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
              : isLight
              ? "text-slate-600 hover:text-slate-900"
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
              ? isLight
                ? "bg-white text-cyan-700 border border-slate-200 shadow-sm"
                : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
              : isLight
              ? "text-slate-600 hover:text-slate-900"
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
              ? isLight
                ? "bg-white text-cyan-700 border border-slate-200 shadow-sm"
                : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
              : isLight
              ? "text-slate-600 hover:text-slate-900"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Integrity & Hazards</span>
        </button>
      </div>

      {/* Right Primary Actions */}
      <div className="flex items-center gap-2">
        {/* Model Performance & Accuracy Button */}
        <button
          onClick={onOpenModelPerformance}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-sm ${
            isLight
              ? "bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-800"
              : "bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/40 text-emerald-300"
          }`}
          title="View Neural Model Accuracy, Benchmark Scores & Error Metrics"
        >
          <BarChart2 className="w-3.5 h-3.5 text-emerald-500" />
          <span>Model Metrics</span>
        </button>

        {/* Device Cockpit Simulator Button */}
        <button
          onClick={onOpenSimulator}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-sm ${
            isLight
              ? "bg-cyan-50 hover:bg-cyan-100 border-cyan-300 text-cyan-800"
              : "bg-gradient-to-r from-cyan-600/30 to-blue-600/30 hover:from-cyan-600/50 hover:to-blue-600/50 border-cyan-500/40 text-cyan-200"
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 text-cyan-500" />
          <span>Phone Simulator</span>
        </button>

        {/* India Maps Store Button */}
        <button
          onClick={onOpenMapPacks}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
            isLight
              ? "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800"
              : "bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-200"
          }`}
        >
          <Map className="w-3.5 h-3.5 text-amber-500" />
          <span>India Maps</span>
        </button>

        {/* Download APK / App Button */}
        <button
          onClick={onOpenApkModal}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black transition-all shadow-md shadow-cyan-950/30"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download App</span>
        </button>

        {/* Light / Dark Mode Toggle Button (Google Maps Style) */}
        <button
          onClick={onToggleTheme}
          title={isLight ? "Switch to Tactical Dark Mode" : "Switch to Google Maps Light Mode"}
          className={`p-2 rounded-xl border transition-all ${
            isLight
              ? "bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-700"
              : "bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-amber-400"
          }`}
        >
          {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
