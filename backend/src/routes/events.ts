import type { FastifyPluginAsync } from "fastify";
import { getDatabase } from "../db/database.js";

export const eventRoutes: FastifyPluginAsync = async (app) => {
  const db = getDatabase();

  app.get<{
    Querystring: {
      type?: string;
      from?: number;
      to?: number;
      limit?: number;
    };
  }>("/v1/events", async (request) => {
    const { type, from, to, limit = 100 } = request.query;

    let sql = "SELECT id, device_id, trip_id, t_ms, lat, lon, type, payload FROM events WHERE 1=1";
    const params: any[] = [];

    if (type) {
      sql += " AND type = ?";
      params.push(type);
    }
    if (from) {
      sql += " AND t_ms >= ?";
      params.push(from);
    }
    if (to) {
      sql += " AND t_ms <= ?";
      params.push(to);
    }

    sql += " ORDER BY t_ms DESC LIMIT ?";
    params.push(limit);

    const rows = db.prepare(sql).all(...params) as Array<{
      id: number;
      device_id: string;
      trip_id: string;
      t_ms: number;
      lat: number | null;
      lon: number | null;
      type: string;
      payload: string;
    }>;

    const features = rows
      .filter((r) => r.lat !== null && r.lon !== null)
      .map((r) => {
        let payloadParsed = {};
        try {
          payloadParsed = JSON.parse(r.payload);
        } catch {
          payloadParsed = { raw: r.payload };
        }

        return {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [r.lon, r.lat],
          },
          properties: {
            id: r.id,
            device_id: r.device_id,
            trip_id: r.trip_id,
            t_ms: r.t_ms,
            event_type: r.type,
            details: payloadParsed,
          },
        };
      });

    return {
      type: "FeatureCollection",
      features,
    };
  });
};
