import React, { useState, useEffect } from "react";
import { Header } from "./components/Header.js";
import { MapView } from "./components/MapView.js";
import { TelemetryPanel } from "./components/TelemetryPanel.js";
import { TripReplayPanel } from "./components/TripReplayPanel.js";
import { EventLog } from "./components/EventLog.js";
import { DeviceSimulator } from "./components/DeviceSimulator.js";
import { MapPackModal } from "./components/MapPackModal.js";
import { ApkDownloadModal } from "./components/ApkDownloadModal.js";
import { ModelPerformanceModal } from "./components/ModelPerformanceModal.js";
import { api } from "./api/client.js";
import { mobileSensors } from "./services/mobileSensorService.js";
import type { DeviceTelemetry, NavEvent, RoadHazard } from "./types.js";

export const App: React.FC = () => {
  const [activeView, setActiveView] = useState<"live" | "replay" | "events">("live");
  const [telemetryMap, setTelemetryMap] = useState<Map<string, DeviceTelemetry>>(new Map());
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [events, setEvents] = useState<NavEvent[]>([]);
  const [hazards, setHazards] = useState<RoadHazard[]>([]);
  const [replayTrack, setReplayTrack] = useState<[number, number][]>([]);

  // Theme state: dark (default tactical) or light (Google Maps daytime street style)
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Modals
  const [showSimulator, setShowSimulator] = useState<boolean>(false);
  const [showMapPacks, setShowMapPacks] = useState<boolean>(false);
  const [showApkModal, setShowApkModal] = useState<boolean>(false);
  const [showModelPerformance, setShowModelPerformance] = useState<boolean>(false);
  const [activeRegion, setActiveRegion] = useState<string>("mumbai_metro");

  // Synchronize theme with body
  useEffect(() => {
    if (theme === "light") {
      document.body.classList.add("light-theme");
    } else {
      document.body.classList.remove("light-theme");
    }
  }, [theme]);

  // Initial fetch and subscription
  useEffect(() => {
    // Start sensor background capture if on mobile phone
    mobileSensors.start();

    // Fetch initial state
    api.getLiveFeatures().then((devices) => {
      const map = new Map<string, DeviceTelemetry>();
      for (const d of devices) {
        map.set(d.device_id, d);
      }
      setTelemetryMap(map);
      if (devices.length > 0 && !selectedDevice) {
        setSelectedDevice(devices[0].device_id);
      }
    });

    api.getEvents().then(setEvents);
    api.getRoadHazards().then(setHazards);

    // Subscribe to live telemetry stream
    const unsubscribe = api.onTelemetry((telemetry) => {
      setTelemetryMap((prev) => {
        const next = new Map(prev);
        next.set(telemetry.device_id, telemetry);
        return next;
      });
    });

    return () => {
      unsubscribe();
      mobileSensors.stop();
    };
  }, []);

  const telemetryList = Array.from(telemetryMap.values());
  const currentTelemetry = selectedDevice ? telemetryMap.get(selectedDevice) || null : telemetryList[0] || null;

  const handleSeekReplay = (progress: number) => {
    const fullPoints: [number, number][] = [
      [72.8450, 18.9400],
      [72.8550, 18.9600],
      [72.8620, 18.9800],
      [72.8700, 19.0000],
      [72.8750, 19.0200],
      [72.8760, 19.0225],
      [72.8770, 19.0250],
      [72.8780, 19.0280],
      [72.8800, 19.0350],
      [72.8830, 19.0450],
    ];

    const idx = Math.min(fullPoints.length - 1, Math.floor(progress * fullPoints.length));
    const sub = fullPoints.slice(0, idx + 1);
    setReplayTrack(sub);

    if (currentTelemetry && sub.length > 0) {
      const [lon, lat] = sub[sub.length - 1];
      const isTunnel = lat >= 19.0200 && lat <= 19.0280;
      setTelemetryMap((prev) => {
        const next = new Map(prev);
        next.set(currentTelemetry.device_id, {
          ...currentTelemetry,
          lat,
          lon,
          mode: isTunnel ? "DR" : "GNSS_OK",
          hpl_m: isTunnel ? 7.6 : 3.4,
        });
        return next;
      });
    }
  };

  const handleInjectOutage = (durationS: number) => {
    if (currentTelemetry) {
      setTelemetryMap((prev) => {
        const next = new Map(prev);
        next.set(currentTelemetry.device_id, {
          ...currentTelemetry,
          mode: "DR",
          hpl_m: currentTelemetry.hpl_m + durationS * 0.05,
        });
        return next;
      });
    }
  };

  const handleSelectSimulatedVehicle = (deviceId: string) => {
    setSelectedDevice(deviceId);
    setShowSimulator(false);
  };

  return (
    <div
      className={`relative w-screen h-screen overflow-hidden flex flex-col transition-colors duration-300 ${
        theme === "light" ? "bg-slate-100 text-slate-900" : "bg-slate-950 text-white"
      }`}
    >
      {/* Absolute Header Overlay */}
      <Header
        activeView={activeView}
        onViewChange={setActiveView}
        activeVehiclesCount={telemetryList.length}
        onOpenSimulator={() => setShowSimulator(true)}
        onOpenMapPacks={() => setShowMapPacks(true)}
        onOpenApkModal={() => setShowApkModal(true)}
        onOpenModelPerformance={() => setShowModelPerformance(true)}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      />

      {/* Main Map Canvas */}
      <div className="absolute inset-0 z-0">
        <MapView
          telemetryList={telemetryList}
          selectedDevice={selectedDevice}
          onSelectDevice={setSelectedDevice}
          hazards={hazards}
          replayTrack={replayTrack}
          activeRegion={activeRegion}
          onRegionChange={setActiveRegion}
          theme={theme}
        />
      </div>

      {/* Floating Tactical Overlay Panels */}
      <div className="absolute left-6 bottom-6 z-10 flex flex-col gap-3">
        {activeView === "live" && <TelemetryPanel telemetry={currentTelemetry} />}
        {activeView === "replay" && (
          <TripReplayPanel onSeek={handleSeekReplay} onInjectOutage={handleInjectOutage} />
        )}
        {activeView === "events" && <EventLog events={events} hazards={hazards} />}
      </div>

      {/* Vehicle Switcher Bar (Bottom-Right) */}
      <div
        className={`absolute right-6 bottom-6 z-10 p-2 flex items-center gap-2 max-w-[50vw] overflow-x-auto rounded-xl border backdrop-blur-md shadow-lg transition-all ${
          theme === "light"
            ? "bg-white/95 border-slate-300 text-slate-800 shadow-slate-200/50"
            : "glass-panel text-white border-slate-700/80"
        }`}
      >
        <span
          className={`text-[10px] font-bold px-2 uppercase shrink-0 ${
            theme === "light" ? "text-slate-500" : "text-slate-400"
          }`}
        >
          Fleet:
        </span>
        {telemetryList.map((d) => (
          <button
            key={d.device_id}
            onClick={() => setSelectedDevice(d.device_id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              d.device_id === selectedDevice
                ? theme === "light"
                  ? "bg-cyan-100 text-cyan-900 border border-cyan-400 shadow-sm"
                  : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow"
                : theme === "light"
                ? "bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200"
                : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            {d.device_id} ({d.vehicle_mode})
          </button>
        ))}
      </div>

      {/* Interactive Physical Device Cockpit Simulator Modal */}
      {showSimulator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <DeviceSimulator
            onClose={() => setShowSimulator(false)}
            onSelectVehicle={handleSelectSimulatedVehicle}
          />
        </div>
      )}

      {/* India Map Packs Store Modal */}
      <MapPackModal
        isOpen={showMapPacks}
        onClose={() => setShowMapPacks(false)}
        onSelectRegion={(reg) => {
          setActiveRegion(reg);
          setShowMapPacks(false);
        }}
      />

      {/* APK & App Download Modal */}
      <ApkDownloadModal
        isOpen={showApkModal}
        onClose={() => setShowApkModal(false)}
      />

      {/* Neural Model Accuracy & Benchmark Performance Modal */}
      <ModelPerformanceModal
        isOpen={showModelPerformance}
        onClose={() => setShowModelPerformance(false)}
        theme={theme}
      />
    </div>
  );
};
