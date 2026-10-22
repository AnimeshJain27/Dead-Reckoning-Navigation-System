import type { FastifyPluginAsync } from "fastify";
import { getDatabase } from "../db/database.js";

export const hazardRoutes: FastifyPluginAsync = async (app) => {
  const db = getDatabase();

  app.get<{
    Querystring: {
      kind?: string;
      limit?: number;
    };
  }>("/v1/road-conditions", async (request) => {
    const { kind, limit = 200 } = request.query;

    let sql = "SELECT id, device_id, t_ms, lat, lon, kind, severity FROM road_conditions WHERE 1=1";
    const params: any[] = [];

    if (kind) {
      sql += " AND kind = ?";
      params.push(kind.toUpperCase());
    }

    sql += " ORDER BY t_ms DESC LIMIT ?";
    params.push(limit);

    const rows = db.prepare(sql).all(...params) as Array<{
      id: number;
      device_id: string;
      t_ms: number;
      lat: number;
      lon: number;
      kind: string;
      severity: number;
    }>;

    const features = rows.map((r) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [r.lon, r.lat],
      },
      properties: {
        id: r.id,
        device_id: r.device_id,
        t_ms: r.t_ms,
        kind: r.kind,
        severity: r.severity,
      },
    }));

    return {
      type: "FeatureCollection",
      features,
    };
  });
};
