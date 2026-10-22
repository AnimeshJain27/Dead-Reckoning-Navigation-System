import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { Navigation } from "lucide-react";
import type { DeviceTelemetry, RoadHazard } from "../types.js";

interface MapViewProps {
  telemetryList: DeviceTelemetry[];
  selectedDevice: string | null;
  onSelectDevice: (deviceId: string) => void;
  hazards: RoadHazard[];
  replayTrack?: [number, number][];
  activeRegion?: string;
  onRegionChange?: (region: string) => void;
}

export const MapView: React.FC<MapViewProps> = ({
  telemetryList,
  selectedDevice,
  onSelectDevice,
  hazards,
  replayTrack,
  activeRegion = "mumbai_metro",
  onRegionChange,
}) => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const hazardMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [region, setRegion] = useState<string>(activeRegion);

  const regionConfigs: Record<string, { label: string; center: [number, number]; zoom: number }> = {
    my_location: {
      label: "📍 My Live Location (India)",
      center: [78.9629, 20.5937],
      zoom: 15.5,
    },
    pan_india: {
      label: "🇮🇳 Pan-India Highways",
      center: [78.9629, 21.5937],
      zoom: 4.8,
    },
    mumbai_metro: {
      label: "Mumbai Eastern Freeway",
      center: [72.8650, 19.0000],
      zoom: 12.5,
    },
    delhi_ncr: {
      label: "Delhi Ring Road & Tunnel",
      center: [77.2400, 28.6200],
      zoom: 12.8,
    },
    bengaluru_metro: {
      label: "Bengaluru Outer Ring Road",
      center: [77.5800, 12.9700],
      zoom: 12.5,
    },
    national_highway_india: {
      label: "NH-48 Mumbai-Pune Expressway",
      center: [73.3420, 18.7750],
      zoom: 11.5,
    },
  };

  const handleSelectRegion = (rKey: string) => {
    setRegion(rKey);
    if (onRegionChange) onRegionChange(rKey);

    if (rKey === "my_location") {
      locateUser();
      return;
    }

    const target = regionConfigs[rKey];
    if (map.current && target) {
      map.current.flyTo({
        center: target.center,
        zoom: target.zoom,
        pitch: rKey === "pan_india" ? 0 : 35,
        duration: 1800,
        essential: true,
      });
    }
  };

  const locateUser = () => {
    // Check if phone sensor telemetry is already streaming coordinates
    const phoneTelem = telemetryList.find((t) => t.device_id.startsWith("PHONE_") || t.device_id.startsWith("DEV_LIVE"));
    if (phoneTelem && phoneTelem.lat && phoneTelem.lon) {
      map.current?.flyTo({
        center: [phoneTelem.lon, phoneTelem.lat],
        zoom: 16,
        pitch: 35,
        duration: 1800,
        essential: true,
      });
      return;
    }

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          map.current?.flyTo({
            center: [pos.coords.longitude, pos.coords.latitude],
            zoom: 16,
            pitch: 35,
            duration: 1800,
            essential: true,
          });
        },
        (err) => {
          alert(`Unable to get GPS location: ${err.message}. Please enable location permissions.`);
        },
        { enableHighAccuracy: true }
      );
    }
  };

  useEffect(() => {
    if (activeRegion && activeRegion !== region) {
      handleSelectRegion(activeRegion);
    }
  }, [activeRegion]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const initial = regionConfigs[region] || regionConfigs.mumbai_metro;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          esri_dark: {
            type: "raster",
            tiles: [
              "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
            ],
            tileSize: 256,
            attribution: "© Esri, HERE, Garmin, OpenStreetMap contributors",
            maxzoom: 16,
          },
          esri_reference: {
            type: "raster",
            tiles: [
              "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
            ],
            tileSize: 256,
            maxzoom: 16,
          },
        },
        layers: [
          {
            id: "esri-dark-tiles",
            type: "raster",
            source: "esri_dark",
            minzoom: 0,
            maxzoom: 22,
          },
          {
            id: "esri-reference-tiles",
            type: "raster",
            source: "esri_reference",
            minzoom: 0,
            maxzoom: 22,
          },
        ],
      },
      center: initial.center,
      zoom: initial.zoom,
      pitch: region === "pan_india" ? 0 : 35,
    });

    map.current.addControl(new maplibregl.NavigationControl(), "top-right");
    map.current.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
      "top-right"
    );

    map.current.on("load", () => {
      if (!map.current) return;

      // Add Multi-Corridor Features across India
      map.current.addSource("india-corridors", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            // Mumbai: Eastern Freeway
            {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: [
                  [72.8450, 18.9400],
                  [72.8550, 18.9600],
                  [72.8620, 18.9800],
                  [72.8700, 19.0000],
                  [72.8750, 19.0200],
                ],
              },
              properties: { name: "Mumbai Eastern Freeway Mainline", type: "freeway" },
            },
            {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: [
                  [72.8750, 19.0200],
                  [72.8760, 19.0225],
                  [72.8770, 19.0250],
                  [72.8780, 19.0280],
                ],
              },
              properties: { name: "Eastern Freeway Anik Tunnel (510 m)", type: "tunnel" },
            },
            {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: [
                  [72.8780, 19.0280],
                  [72.8800, 19.0350],
                  [72.8830, 19.0450],
                ],
              },
              properties: { name: "Eastern Freeway North", type: "freeway" },
            },

            // Delhi: Ring Road & Pragati Maidan Tunnel
            {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: [
                  [77.2100, 28.6100],
                  [77.2250, 28.6140],
                  [77.2350, 28.6170],
                ],
              },
              properties: { name: "Delhi Ring Road / Mathura Rd", type: "freeway" },
            },
            {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: [
                  [77.2350, 28.6170],
                  [77.2400, 28.6185],
                  [77.2460, 28.6200],
                  [77.2510, 28.6215],
                ],
              },
              properties: { name: "Pragati Maidan 6-Lane Tunnel (1.3 km)", type: "tunnel" },
            },

            // Bengaluru: Outer Ring Road & Majestic Tunnel
            {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: [
                  [77.5600, 12.9650],
                  [77.5670, 12.9700],
                ],
              },
              properties: { name: "Bengaluru Central Arterial", type: "freeway" },
            },
            {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: [
                  [77.5670, 12.9700],
                  [77.5720, 12.9750],
                  [77.5760, 12.9800],
                ],
              },
              properties: { name: "Majestic Transit Underground Tunnel (1.1 km)", type: "tunnel" },
            },

            // National Highway: NH-48 Khandala Ghat Tunnel
            {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: [
                  [73.2800, 18.7400],
                  [73.3100, 18.7600],
                  [73.3350, 18.7700],
                ],
              },
              properties: { name: "Mumbai-Pune Expressway (NH-48)", type: "freeway" },
            },
            {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: [
                  [73.3350, 18.7700],
                  [73.3420, 18.7750],
                  [73.3550, 18.7830],
                ],
              },
              properties: { name: "Bhor Ghat Khandala Tunnel (1.8 km)", type: "tunnel" },
            },

            // Pan-India Golden Quadrilateral Trunk Lines
            {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: [
                  [77.2090, 28.6139], // Delhi
                  [72.8777, 19.0760], // Mumbai
                  [77.5946, 12.9716], // Bengaluru
                  [80.2707, 13.0827], // Chennai
                  [88.3639, 22.5726], // Kolkata
                  [77.2090, 28.6139], // Back to Delhi
                ],
              },
              properties: { name: "Golden Quadrilateral Expressways", type: "trunk" },
            },
          ],
        },
      });

      // Regular freeway line
      map.current.addLayer({
        id: "freeway-line",
        type: "line",
        source: "india-corridors",
        filter: ["==", "type", "freeway"],
        paint: {
          "line-color": "#06b6d4",
          "line-width": 4,
          "line-opacity": 0.8,
        },
      });

      // Trunk National Quadrilateral
      map.current.addLayer({
        id: "trunk-line",
        type: "line",
        source: "india-corridors",
        filter: ["==", "type", "trunk"],
        paint: {
          "line-color": "#38bdf8",
          "line-width": 2.5,
          "line-opacity": 0.5,
          "line-dasharray": [3, 2],
        },
      });

      // Tunnel corridor layer (distinct glowing dashed orange line)
      map.current.addLayer({
        id: "tunnel-line",
        type: "line",
        source: "india-corridors",
        filter: ["==", "type", "tunnel"],
        paint: {
          "line-color": "#f59e0b",
          "line-width": 6,
          "line-dasharray": [2, 2],
          "line-opacity": 0.95,
        },
      });

      // Replay track source
      map.current.addSource("replay-track", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [],
          },
          properties: {},
        },
      });

      map.current.addLayer({
        id: "replay-line",
        type: "line",
        source: "replay-track",
        paint: {
          "line-color": "#38bdf8",
          "line-width": 4,
          "line-dasharray": [1, 1],
        },
      });
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update Replay Track
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;
    const src = map.current.getSource("replay-track") as maplibregl.GeoJSONSource | undefined;
    if (src && replayTrack) {
      src.setData({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: replayTrack,
        },
        properties: {},
      });
    }
  }, [replayTrack]);

  // Update Vehicle Markers and HPL Ellipses
  useEffect(() => {
    if (!map.current) return;

    const activeIds = new Set(telemetryList.map((t) => t.device_id));

    // Remove obsolete markers
    for (const [id, marker] of markersRef.current.entries()) {
      if (!activeIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }

    // Add or update markers
    for (const t of telemetryList) {
      const isSelected = t.device_id === selectedDevice;
      let marker = markersRef.current.get(t.device_id);

      if (!marker) {
        const el = document.createElement("div");
        el.className = "vehicle-marker cursor-pointer";
        el.innerHTML = `
          <div class="vehicle-pulse"></div>
          <div class="w-8 h-8 rounded-full bg-slate-900 border-2 flex items-center justify-center text-xs font-bold transition-transform shadow-lg marker-icon">
            <svg class="w-4 h-4 text-cyan-400 heading-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>
            </svg>
          </div>
          <div class="hpl-ring absolute rounded-full border border-dashed pointer-events-none transition-all"></div>
        `;

        el.addEventListener("click", () => {
          onSelectDevice(t.device_id);
        });

        marker = new maplibregl.Marker({ element: el })
          .setLngLat([t.lon, t.lat])
          .addTo(map.current);

        markersRef.current.set(t.device_id, marker);
      } else {
        marker.setLngLat([t.lon, t.lat]);
      }

      // Update marker appearance
      const el = marker.getElement();
      const icon = el.querySelector(".marker-icon") as HTMLElement;
      const arrow = el.querySelector(".heading-arrow") as HTMLElement;
      const hplRing = el.querySelector(".hpl-ring") as HTMLElement;

      let borderColor = "#34d399";
      let hplColor = "rgba(52, 211, 153, 0.3)";
      if (t.mode === "DR") {
        borderColor = "#fbbf24";
        hplColor = "rgba(251, 191, 36, 0.4)";
      } else if (t.mode === "DEGRADED") {
        borderColor = "#fb923c";
        hplColor = "rgba(251, 146, 60, 0.4)";
      } else if (t.mode === "SUSPECT_RF") {
        borderColor = "#f43f5e";
        hplColor = "rgba(244, 63, 94, 0.5)";
      }

      if (icon) {
        icon.style.borderColor = borderColor;
        icon.style.transform = isSelected ? "scale(1.25)" : "scale(1)";
      }
      if (arrow) {
        arrow.style.transform = `rotate(${t.heading_deg}deg)`;
      }

      if (hplRing) {
        const hplPixels = Math.max(20, Math.min(180, t.hpl_m * 4));
        hplRing.style.width = `${hplPixels}px`;
        hplRing.style.height = `${hplPixels * 0.7}px`;
        hplRing.style.borderColor = borderColor;
        hplRing.style.backgroundColor = hplColor;
        hplRing.style.transform = `rotate(${t.heading_deg}deg)`;
      }
    }
  }, [telemetryList, selectedDevice, onSelectDevice]);

  // Update Hazard Markers
  useEffect(() => {
    if (!map.current) return;

    for (const m of hazardMarkersRef.current) {
      m.remove();
    }
    hazardMarkersRef.current = [];

    for (const h of hazards) {
      const el = document.createElement("div");
      el.className = "hazard-marker px-1.5 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 shadow-md";
      if (h.kind === "POTHOLE") {
        el.className += " bg-rose-950/80 border-rose-500 text-rose-300";
        el.innerHTML = "⚠️ Pothole";
      } else {
        el.className += " bg-amber-950/80 border-amber-500 text-amber-300";
        el.innerHTML = "⚡ Bump";
      }

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([h.lon, h.lat])
        .addTo(map.current);

      hazardMarkersRef.current.push(marker);
    }
  }, [hazards]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Floating Region Selector Pill on Map Canvas */}
      <div className="absolute top-20 left-6 z-10 glass-panel px-3 py-1.5 flex items-center gap-2">
        <span className="text-[10px] text-slate-400 font-bold uppercase">Region:</span>
        <select
          value={region}
          onChange={(e) => handleSelectRegion(e.target.value)}
          className="bg-slate-900 text-cyan-300 border border-slate-700 rounded-lg text-xs font-bold px-2.5 py-1 focus:outline-none focus:border-cyan-400 cursor-pointer"
        >
          {Object.entries(regionConfigs).map(([k, cfg]) => (
            <option key={k} value={k}>
              {cfg.label}
            </option>
          ))}
        </select>

        <button
          onClick={locateUser}
          title="Fly to your live GPS coordinates anywhere in India"
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/50 text-cyan-200 text-xs font-bold transition-all"
        >
          <Navigation className="w-3 h-3 text-cyan-400 animate-pulse" />
          <span>Locate Me</span>
        </button>
      </div>
    </div>
  );
};
