import type { FastifyPluginAsync } from "fastify";
import crypto from "node:crypto";
import { getDatabase } from "../db/database.js";

export const deviceRoutes: FastifyPluginAsync = async (app) => {
  const db = getDatabase();

  app.post<{ Body: { name: string } }>("/v1/devices", async (request, reply) => {
    const { name } = request.body || {};
    if (!name) {
      return reply.code(400).send({ error: "Device name is required" });
    }

    const deviceId = `DEV_${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const rawKey = `idr_key_${crypto.randomBytes(16).toString("hex")}`;
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT INTO devices (id, name, key_hash, created_at, last_seen)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(deviceId, name, keyHash, now, now);

    return reply.code(201).send({
      device_id: deviceId,
      device_key: rawKey,
      name,
      created_at: now,
    });
  });

  app.get("/v1/devices", async () => {
    const stmt = db.prepare(`
      SELECT id, name, created_at, last_seen FROM devices ORDER BY created_at DESC
    `);
    return stmt.all();
  });
};
