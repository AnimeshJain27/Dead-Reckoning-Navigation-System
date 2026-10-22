import React, { useState, useEffect } from "react";
import { Download, Map, CheckCircle2, X, Database, ArrowDownToLine, RefreshCw } from "lucide-react";
import { api } from "../api/client.js";

interface MapPackInfo {
  region: string;
  files: Array<{
    filename: string;
    size_bytes: number;
    updated_at: number;
    download_url: string;
  }>;
}

interface MapPackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRegion?: (region: string) => void;
}

export const MapPackModal: React.FC<MapPackModalProps> = ({ isOpen, onClose, onSelectRegion }) => {
  const [packs, setPacks] = useState<MapPackInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [cachedRegions, setCachedRegions] = useState<Set<string>>(new Set());

  const regionMetadata: Record<string, { title: string; coverage: string; tunnels: string; description: string }> = {
    national_highway_india: {
      title: "Pan-India National Highway Network",
      coverage: "Entire India (NH-48, NH-44, Delhi-Mumbai NE-4 Expressway, Golden Quadrilateral)",
      tunnels: "Atal Tunnel Rohtang (9.02 km), Bhor Ghat Khandala (1.8 km)",
      description: "Nationwide high-speed corridor routing graph with full dead-reckoning tunnel geometry.",
    },
    mumbai_metro: {
      title: "Mumbai Metropolitan Region",
      coverage: "South Mumbai to Chembur / Eastern Freeway",
      tunnels: "Anik Tunnel (510 m)",
      description: "Dual-tube freeway tunnel navigation with R*Tree spatial indexing.",
    },
    delhi_ncr: {
      title: "Delhi-NCR Capital Corridor",
      coverage: "Ring Road, Central Vista & Pragati Maidan",
      tunnels: "Pragati Maidan 6-Lane Tunnel (1.3 km)",
      description: "Deep underground transit corridor with strict multipath suppression.",
    },
    bengaluru_metro: {
      title: "Bengaluru Tech Corridor",
      coverage: "Outer Ring Road, Silk Board & Central Transit",
      tunnels: "Majestic Underground Transit (1.1 km)",
      description: "Dense urban canyon routing graph with high-elevation flyover support.",
    },
  };

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api.getMapPacks()
        .then((data) => {
          setPacks(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDownload = (region: string, filename: string) => {
    const key = `${region}/${filename}`;
    setDownloadingFile(key);
    const url = api.getMapPackDownloadUrl(region, filename);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${region}_${filename}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      setDownloadingFile(null);
      setCachedRegions((prev) => new Set(prev).add(region));
    }, 800);
  };

  const handleDownloadAll = () => {
    packs.forEach((p) => {
      p.files.forEach((f) => {
        handleDownload(p.region, f.filename);
      });
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md select-none">
      <div className="glass-panel w-full max-w-3xl p-6 relative flex flex-col gap-5 border border-slate-700/80 shadow-2xl max-h-[90vh] overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Title & Actions Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400">
              <Map className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                India Offline Map Packs & Corridors
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  SQLite R*Tree
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Download nationwide and metropolitan offline map packs at will for zero-signal dead reckoning navigation.
              </p>
            </div>
          </div>

          <button
            onClick={handleDownloadAll}
            className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 transition-all whitespace-nowrap self-start sm:self-center"
          >
            <ArrowDownToLine className="w-4 h-4" /> Download All India Packs
          </button>
        </div>

        {/* Map Packs Grid */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {loading ? (
            <div className="py-12 text-center text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
              <span>Loading available India map packs...</span>
            </div>
          ) : (
            packs.map((pack) => {
              const meta = regionMetadata[pack.region] || {
                title: pack.region,
                coverage: "India Regional Road Network",
                tunnels: "Urban and Highway Tunnels",
                description: "Offline routing and tunnel geometry pack.",
              };
              const isCached = cachedRegions.has(pack.region);

              return (
                <div
                  key={pack.region}
                  className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all hover:border-slate-700"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-white">{meta.title}</span>
                      {isCached && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Ready Offline
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-cyan-300/90 font-medium">
                      Coverage: <span className="text-slate-300">{meta.coverage}</span>
                    </div>
                    <div className="text-[11px] text-amber-300/90">
                      Tunnels: <span className="text-slate-300">{meta.tunnels}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">{meta.description}</p>
                  </div>

                  {/* Actions & File List */}
                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    {onSelectRegion && (
                      <button
                        onClick={() => {
                          onSelectRegion(pack.region);
                          onClose();
                        }}
                        className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700"
                      >
                        View on Map
                      </button>
                    )}

                    {pack.files.map((file) => {
                      const key = `${pack.region}/${file.filename}`;
                      const isDownloading = downloadingFile === key;

                      return (
                        <button
                          key={file.filename}
                          onClick={() => handleDownload(pack.region, file.filename)}
                          disabled={isDownloading}
                          className="py-1.5 px-3 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 text-xs font-bold flex items-center gap-1.5 transition-all"
                        >
                          {isDownloading ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-300" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          <span>{file.filename}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({formatSize(file.size_bytes)})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Specification Note */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
          <div className="flex items-center gap-1.5">
            <Database className="w-4 h-4 text-cyan-400" />
            <span>Format: SQLite 3.45 with WAL mode, Spatial R*Tree, UBODT routing matrices</span>
          </div>
          <span className="text-slate-500 font-mono">MAP_SCHEMA v1.0 Spec</span>
        </div>
      </div>
    </div>
  );
};
