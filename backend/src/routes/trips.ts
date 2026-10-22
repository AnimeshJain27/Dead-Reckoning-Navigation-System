import type { FastifyPluginAsync } from "fastify";
import { getDatabase } from "../db/database.js";

export const tripRoutes: FastifyPluginAsync = async (app) => {
  const db = getDatabase();

  app.get("/v1/trips", async () => {
    const stmt = db.prepare(`
      SELECT t.id, t.device_id, d.name as device_name, t.started_at, t.ended_at,
             t.distance_m, t.dr_distance_m, t.max_hpl_m, t.vehicle_mode
      FROM trips t
      LEFT JOIN devices d ON t.device_id = d.id
      ORDER BY t.started_at DESC
      LIMIT 100
    `);
    return stmt.all();
  });

  app.get<{ Params: { id: string } }>("/v1/trips/:id/track", async (request, reply) => {
    const { id } = request.params;
    const stmt = db.prepare(`
      SELECT lat, lon, t_ms, speed_mps, heading_deg, mode, hpl_m
      FROM states
      WHERE trip_id = ?
      ORDER BY t_ms ASC
    `);

    const rows = stmt.all(id) as Array<{
      lat: number;
      lon: number;
      t_ms: number;
      speed_mps: number;
      heading_deg: number;
      mode: string;
      hpl_m: number;
    }>;

    if (!rows || rows.length === 0) {
      return reply.code(404).send({ error: `Trip ${id} not found or has no track states` });
    }

    const coordinates = rows.map((r) => [r.lon, r.lat]);
    const timestamps = rows.map((r) => r.t_ms);
    const speeds = rows.map((r) => r.speed_mps);
    const modes = rows.map((r) => r.mode);
    const hpls = rows.map((r) => r.hpl_m);

    return {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates,
      },
      properties: {
        trip_id: id,
        points_count: rows.length,
        timestamps,
        speeds,
        modes,
        hpls,
      },
    };
  });
};
