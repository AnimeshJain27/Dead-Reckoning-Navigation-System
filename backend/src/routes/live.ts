import type { FastifyPluginAsync } from "fastify";
import { telemetryService } from "../services/telemetry.js";

export const liveRoutes: FastifyPluginAsync = async (app) => {
  // GeoJSON FeatureCollection endpoint
  app.get("/v1/live", async () => {
    const states = telemetryService.getAllLatestStates();
    const features = states.map((st) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [st.lon, st.lat],
      },
      properties: {
        device_id: st.device_id,
        trip_id: st.trip_id,
        t_ms: st.t_ms,
        speed_mps: st.speed_mps,
        speed_kmh: Math.round(st.speed_mps * 3.6 * 10) / 10,
        heading_deg: st.heading_deg,
        mode: st.mode,
        hpl_m: st.hpl_m,
        ell_major_m: st.ell_major_m ?? st.hpl_m,
        ell_minor_m: st.ell_minor_m ?? st.hpl_m * 0.7,
        ell_angle_deg: st.ell_angle_deg ?? st.heading_deg,
        vehicle_mode: st.vehicle_mode || "CAR",
        way_id: st.way_id || 0,
        level: st.level || 0,
      },
    }));

    return {
      type: "FeatureCollection",
      features,
    };
  });

  // WebSocket Live Stream
  app.get("/v1/stream/live", { websocket: true }, (connection) => {
    telemetryService.registerClient(connection);
  });
};
