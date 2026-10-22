import React, { useState } from "react";
import {
  Activity,
  X,
  Shield,
  Gauge,
  TrendingDown,
  Cpu,
  Layers,
  CheckCircle2,
  Download,
  Zap,
} from "lucide-react";

interface ModelPerformanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: "dark" | "light";
}

export const ModelPerformanceModal: React.FC<ModelPerformanceModalProps> = ({
  isOpen,
  onClose,
  theme = "dark",
}) => {
  const [activeTab, setActiveTab] = useState<"overview" | "durations" | "architecture">("overview");

  if (!isOpen) return null;

  const isLight = theme === "light";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md select-none overflow-y-auto">
      <div
        className={`w-full max-w-4xl p-6 relative flex flex-col gap-5 rounded-2xl border shadow-2xl max-h-[90vh] overflow-hidden transition-all ${
          isLight
            ? "bg-white text-slate-900 border-slate-200 shadow-slate-300/50"
            : "glass-panel text-white border-slate-700/80"
        }`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 p-1.5 rounded-lg transition-all ${
            isLight
              ? "text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200"
              : "text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700"
          }`}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Title */}
        <div className="flex items-center gap-3 border-b pb-4 border-slate-700/60">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black tracking-wide">
                IDR 26168 Neural Model Accuracy & Performance
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                Evaluated on IO-VNBD (220 Runs)
              </span>
            </div>
            <p className={`text-xs ${isLight ? "text-slate-500" : "text-slate-400"}`}>
              Quantitative benchmark metrics against published deep inertial odometry architectures with zero CAN/OBD bus connections.
            </p>
          </div>
        </div>

        {/* Top 4 KPI Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* KPI 1: Speed AEPS Error */}
          <div
            className={`p-3.5 rounded-xl border flex flex-col justify-between ${
              isLight ? "bg-slate-50 border-slate-200" : "bg-slate-900/80 border-slate-800"
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
              <span>Velocity (AEPS)</span>
              <Gauge className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-black text-cyan-400 font-mono tracking-tight">
              6.68 <span className="text-xs font-semibold text-slate-400">m/s</span>
            </div>
            <div className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 mt-1">
              <TrendingDown className="w-3 h-3" /> -52.3% error vs raw INS
            </div>
          </div>

          {/* KPI 2: Tunnel 2D Drift % */}
          <div
            className={`p-3.5 rounded-xl border flex flex-col justify-between ${
              isLight ? "bg-slate-50 border-slate-200" : "bg-slate-900/80 border-slate-800"
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
              <span>Tunnel Outage Drift</span>
              <Shield className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400 font-mono tracking-tight">
              1.84% <span className="text-xs font-semibold text-slate-400">(60s)</span>
            </div>
            <div className="text-[10px] text-slate-400 font-medium mt-1">
              Spec Limit: &lt; 10% (<span className="text-cyan-300 font-bold">&lt; 100 m</span>)
            </div>
          </div>

          {/* KPI 3: Compact Model Size */}
          <div
            className={`p-3.5 rounded-xl border flex flex-col justify-between ${
              isLight ? "bg-slate-50 border-slate-200" : "bg-slate-900/80 border-slate-800"
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
              <span>Model Size</span>
              <Cpu className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-400 font-mono tracking-tight">
              93 <span className="text-xs font-semibold text-slate-400">kB</span>
            </div>
            <div className="text-[10px] text-amber-300 font-semibold mt-1">
              23,367 params (1.5% budget)
            </div>
          </div>

          {/* KPI 4: Inference Latency */}
          <div
            className={`p-3.5 rounded-xl border flex flex-col justify-between ${
              isLight ? "bg-slate-50 border-slate-200" : "bg-slate-900/80 border-slate-800"
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
              <span>Inference Time</span>
              <Zap className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-black text-purple-400 font-mono tracking-tight">
              0.8 <span className="text-xs font-semibold text-slate-400">ms</span>
            </div>
            <div className="text-[10px] text-emerald-400 font-semibold mt-1">
              18x faster than 15 ms limit
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 border-b border-slate-700/60 pb-2">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "overview"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Comparative Matrix vs Baselines
          </button>
          <button
            onClick={() => setActiveTab("durations")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "durations"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Outage Duration Breakdown (10s – 120s)
          </button>
          <button
            onClick={() => setActiveTab("architecture")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "architecture"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Neural Architecture Details
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
          {activeTab === "overview" && (
            <div className="space-y-3">
              <div
                className={`p-3 rounded-xl border ${
                  isLight ? "bg-slate-50 border-slate-200" : "bg-slate-900/60 border-slate-800"
                }`}
              >
                <h3 className="font-bold text-sm mb-2 flex items-center gap-2 text-cyan-400">
                  <Layers className="w-4 h-4" /> Comprehensive Performance vs Published Literature
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-mono text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-700 text-slate-400">
                        <th className="py-2 px-2 font-bold">Method</th>
                        <th className="py-2 px-2 font-bold">Sensors</th>
                        <th className="py-2 px-2 font-bold">Params</th>
                        <th className="py-2 px-2 font-bold">AEPS (m/s)</th>
                        <th className="py-2 px-2 font-bold">2D Drift</th>
                        <th className="py-2 px-2 font-bold">60s Outage EPE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      <tr className="hover:bg-slate-800/30">
                        <td className="py-2 px-2 font-bold text-slate-300">Raw INS (Double Int.)</td>
                        <td className="py-2 px-2 text-slate-400">Phone IMU</td>
                        <td className="py-2 px-2 text-slate-400">0</td>
                        <td className="py-2 px-2 text-rose-400">14.02 m/s</td>
                        <td className="py-2 px-2 text-rose-400">166.3%</td>
                        <td className="py-2 px-2 text-rose-400">1,398.5 m</td>
                      </tr>
                      <tr className="hover:bg-slate-800/30">
                        <td className="py-2 px-2 font-bold text-slate-300">NHC-Only (No Learning)</td>
                        <td className="py-2 px-2 text-slate-400">Phone IMU</td>
                        <td className="py-2 px-2 text-slate-400">0</td>
                        <td className="py-2 px-2 text-amber-400">13.06 m/s</td>
                        <td className="py-2 px-2 text-amber-400">134.9%</td>
                        <td className="py-2 px-2 text-amber-400">1,512.6 m</td>
                      </tr>
                      <tr className="hover:bg-slate-800/30">
                        <td className="py-2 px-2 font-bold text-slate-300">Deep-IMU (Brossard 2020)</td>
                        <td className="py-2 px-2 text-slate-400">Phone IMU</td>
                        <td className="py-2 px-2 text-slate-400">~120k</td>
                        <td className="py-2 px-2 text-amber-300">16.85 m/s</td>
                        <td className="py-2 px-2 text-amber-300">12.4%</td>
                        <td className="py-2 px-2 text-amber-300">68.5 m</td>
                      </tr>
                      <tr className="hover:bg-slate-800/30">
                        <td className="py-2 px-2 font-bold text-slate-400">WhONet (Physical Bound)</td>
                        <td className="py-2 px-2 text-slate-400">Wheel CAN</td>
                        <td className="py-2 px-2 text-slate-400">0 (direct)</td>
                        <td className="py-2 px-2 text-emerald-300">3.50 m/s</td>
                        <td className="py-2 px-2 text-emerald-300">4.2%</td>
                        <td className="py-2 px-2 text-emerald-300">24.1 m</td>
                      </tr>
                      <tr className="bg-cyan-500/10 border-l-4 border-cyan-400 font-bold">
                        <td className="py-2 px-2 text-cyan-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" /> IDR 26168 (This Work)
                        </td>
                        <td className="py-2 px-2 text-cyan-200">Phone IMU+Map</td>
                        <td className="py-2 px-2 text-cyan-200 font-bold">23,367 (93 kB)</td>
                        <td className="py-2 px-2 text-emerald-400 font-bold">6.68 m/s</td>
                        <td className="py-2 px-2 text-emerald-400 font-bold">1.84% (tunnel)</td>
                        <td className="py-2 px-2 text-emerald-400 font-bold">11.2 m</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "durations" && (
            <div className="space-y-2">
              <p className="text-slate-400 text-[11px]">
                Metrics recorded across 44 real-world outages grouped by duration window (10s, 30s, 60s, 120s):
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div
                  className={`p-3 rounded-xl border ${
                    isLight ? "bg-slate-50 border-slate-200" : "bg-slate-900/60 border-slate-800"
                  }`}
                >
                  <div className="font-bold text-cyan-400 text-xs mb-1">10s Short Outages (Urban Underpass)</div>
                  <div className="space-y-1 font-mono text-[11px] text-slate-300">
                    <div>• Speed AEPS: <span className="text-emerald-400 font-bold">6.56 m/s</span> (vs 17.35 m/s INS)</div>
                    <div>• Cumulative Along-Track Error: <span className="text-cyan-300">65.6 m</span></div>
                    <div>• HPL Safety Enclosure Rate: <span className="text-emerald-400 font-bold">99.2%</span></div>
                  </div>
                </div>

                <div
                  className={`p-3 rounded-xl border ${
                    isLight ? "bg-slate-50 border-slate-200" : "bg-slate-900/60 border-slate-800"
                  }`}
                >
                  <div className="font-bold text-cyan-400 text-xs mb-1">30s Medium Outages (City Flyover Shadow)</div>
                  <div className="space-y-1 font-mono text-[11px] text-slate-300">
                    <div>• Speed AEPS: <span className="text-emerald-400 font-bold">5.17 m/s</span> (vs 16.53 m/s INS)</div>
                    <div>• Cumulative Along-Track Error: <span className="text-cyan-300">155.1 m</span></div>
                    <div>• HPL Safety Enclosure Rate: <span className="text-emerald-400 font-bold">98.5%</span></div>
                  </div>
                </div>

                <div
                  className={`p-3 rounded-xl border ${
                    isLight ? "bg-slate-50 border-slate-200" : "bg-slate-900/60 border-slate-800"
                  }`}
                >
                  <div className="font-bold text-cyan-400 text-xs mb-1">60s Extended Outage (~1 km Road Tunnel)</div>
                  <div className="space-y-1 font-mono text-[11px] text-slate-300">
                    <div>• Speed AEPS: <span className="text-emerald-400 font-bold">8.10 m/s</span> (vs 15.96 m/s NHC)</div>
                    <div>• Along-Track Error: <span className="text-cyan-300">486.4 m</span></div>
                    <div>• Tunnel Road Distance Drift: <span className="text-emerald-400 font-bold">1.84%</span></div>
                  </div>
                </div>

                <div
                  className={`p-3 rounded-xl border ${
                    isLight ? "bg-slate-50 border-slate-200" : "bg-slate-900/60 border-slate-800"
                  }`}
                >
                  <div className="font-bold text-cyan-400 text-xs mb-1">120s Extreme Outage (Long Tunnel / Rohtang)</div>
                  <div className="space-y-1 font-mono text-[11px] text-slate-300">
                    <div>• Speed AEPS: <span className="text-emerald-400 font-bold">8.64 m/s</span> (vs 14.65 m/s NHC)</div>
                    <div>• Along-Track Error: <span className="text-cyan-300">1037.7 m</span></div>
                    <div>• Continuous Dead Reckoning Duration: <span className="text-emerald-400 font-bold">2 full minutes</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "architecture" && (
            <div className="space-y-3">
              <div
                className={`p-3.5 rounded-xl border ${
                  isLight ? "bg-slate-50 border-slate-200" : "bg-slate-900/60 border-slate-800"
                }`}
              >
                <h4 className="font-bold text-sm text-cyan-400 mb-1.5">M2 P-AIVE Speed TCN (`models/speed_tcn.onnx`)</h4>
                <p className="text-slate-400 text-[11px] mb-2">
                  1-D Dilated Temporal Convolutional Network with residual connections. Ingests 6-DoF vehicle-frame motion ($a_x, a_y, a_z, \omega_x, \omega_y, \omega_z$) at 10 Hz and estimates instantaneous forward velocity without double integration divergence.
                </p>
                <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-center">
                  <div className="bg-black/30 p-2 rounded-lg border border-slate-800">
                    <div className="text-slate-500 text-[9px]">Parameters</div>
                    <div className="font-bold text-cyan-300">16,418</div>
                  </div>
                  <div className="bg-black/30 p-2 rounded-lg border border-slate-800">
                    <div className="text-slate-500 text-[9px]">Disk Footprint</div>
                    <div className="font-bold text-cyan-300">68 kB</div>
                  </div>
                  <div className="bg-black/30 p-2 rounded-lg border border-slate-800">
                    <div className="text-slate-500 text-[9px]">Inference Time</div>
                    <div className="font-bold text-emerald-400">0.45 ms</div>
                  </div>
                </div>
              </div>

              <div
                className={`p-3.5 rounded-xl border ${
                  isLight ? "bg-slate-50 border-slate-200" : "bg-slate-900/60 border-slate-800"
                }`}
              >
                <h4 className="font-bold text-sm text-cyan-400 mb-1.5">M4 Neural Noise Adapter (`models/noise_adapter.onnx`)</h4>
                <p className="text-slate-400 text-[11px] mb-2">
                  Multi-layer feed-forward network trained through the unrolled IEKF filter. Dynamically predicts measurement covariance matrices $R_k$ and process noise $Q_k$ based on high-frequency IMU vibrations and road surface conditions.
                </p>
                <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-center">
                  <div className="bg-black/30 p-2 rounded-lg border border-slate-800">
                    <div className="text-slate-500 text-[9px]">Parameters</div>
                    <div className="font-bold text-cyan-300">6,949</div>
                  </div>
                  <div className="bg-black/30 p-2 rounded-lg border border-slate-800">
                    <div className="text-slate-500 text-[9px]">Disk Footprint</div>
                    <div className="font-bold text-cyan-300">29 kB</div>
                  </div>
                  <div className="bg-black/30 p-2 rounded-lg border border-slate-800">
                    <div className="text-slate-500 text-[9px]">Inference Time</div>
                    <div className="font-bold text-emerald-400">0.25 ms</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-slate-700/60 pt-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Deterministic Seed 26168 • Fully Reproducible in C++ & Python</span>
          </div>
          <button
            onClick={() => {
              window.open("https://github.com/ArnavCreates/Dead-Reckoning-Navigation-System", "_blank");
            }}
            className="py-1 px-3 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/50 rounded-lg text-cyan-200 font-bold flex items-center gap-1.5 transition-all text-xs"
          >
            <Download className="w-3.5 h-3.5" /> View Results in Repository
          </button>
        </div>
      </div>
    </div>
  );
};
