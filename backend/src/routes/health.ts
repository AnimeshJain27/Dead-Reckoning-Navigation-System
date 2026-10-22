import type { FastifyPluginAsync } from "fastify";
import { getDatabase } from "../db/database.js";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/health", async () => {
    let dbConnected = false;
    try {
      const db = getDatabase();
      const res = db.prepare("SELECT 1 as alive").get() as any;
      dbConnected = res?.alive === 1;
    } catch {
      dbConnected = false;
    }

    return {
      status: dbConnected ? "ok" : "degraded",
      db_connected: dbConnected,
      time: Date.now(),
    };
  });
};
