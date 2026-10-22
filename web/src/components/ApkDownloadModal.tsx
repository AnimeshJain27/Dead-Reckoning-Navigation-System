import React, { useState, useEffect } from "react";
import { Download, Smartphone, QrCode, CheckCircle2, Shield, X, Sparkles } from "lucide-react";

interface ApkDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApkDownloadModal: React.FC<ApkDownloadModalProps> = ({ isOpen, onClose }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentUrl(window.location.origin);

      const handleBeforeInstall = (e: any) => {
        e.preventDefault();
        setDeferredPrompt(e);
      };

      window.addEventListener("beforeinstallprompt", handleBeforeInstall);
      window.addEventListener("appinstalled", () => {
        setIsInstalled(true);
        setDeferredPrompt(null);
      });

      return () => {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      };
    }
  }, []);

  if (!isOpen) return null;

  const handleInstallPwa = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      alert("To install on mobile:\n• On Android Chrome: Tap menu (⋮) -> 'Install app' or 'Add to Home screen'\n• On iOS Safari: Tap Share (⎋) -> 'Add to Home Screen'");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md select-none">
      <div className="glass-panel w-full max-w-xl p-6 relative flex flex-col gap-5 border border-slate-700/80 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              IDR 26168 Mobile Application
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                v1.0 Release
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Download the native Android APK or install directly as an offline Progressive Web App.
            </p>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Native Android APK */}
          <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-cyan-400" /> Native Android APK
                </span>
                <span className="text-[10px] text-cyan-300 font-mono font-bold">ARM64 / v7</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Direct `.apk` package bundling the high-performance C++ `libidr_core.so` engine with 10 Hz IMU sampling.
              </p>
            </div>

            <div className="space-y-2">
              <a
                href="/downloads/idr-navigation-v1.0.apk"
                download="idr-navigation-v1.0.apk"
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 transition-all text-center"
              >
                <Download className="w-4 h-4" /> Download .APK File
              </a>
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
                <Shield className="w-3 h-3 text-emerald-400" /> Verified Clean • Android 8.0+
              </div>
            </div>
          </div>

          {/* Card 2: Install Progressive Web App */}
          <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" /> Instant Install (PWA)
                </span>
                <span className="text-[10px] text-amber-300 font-bold">Zero Setup</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Install straight to home screen. Works on any Android, iOS iPhone, iPad, or desktop browser with full offline caching.
              </p>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleInstallPwa}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                <Smartphone className="w-4 h-4 text-cyan-400" />
                {isInstalled ? "App Installed ✓" : "Install to Home Screen"}
              </button>
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
                <CheckCircle2 className="w-3 h-3 text-cyan-400" /> Offline Capable • Auto Updates
              </div>
            </div>
          </div>
        </div>

        {/* LAN Access Info for Real Phone Testing */}
        <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-slate-300" />
            <span>Open on phone browser:</span>
            <span className="font-mono text-cyan-300 font-bold">{currentUrl || "http://<YOUR-IP>:8080"}</span>
          </div>
          <span className="text-[10px] text-slate-500">Auto-links phone sensors</span>
        </div>
      </div>
    </div>
  );
};
