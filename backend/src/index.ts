import fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

import { CONFIG } from "./config.js";
import { getDatabase } from "./db/database.js";
import { healthRoutes } from "./routes/health.js";
import { deviceRoutes } from "./routes/devices.js";
import { ingestRoutes } from "./routes/ingest.js";
import { liveRoutes } from "./routes/live.js";
import { tripRoutes } from "./routes/trips.js";
import { eventRoutes } from "./routes/events.js";
import { hazardRoutes } from "./routes/hazards.js";
import { mapPackRoutes } from "./routes/mappacks.js";

async function buildServer() {
  const app = fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
    },
  });

  // Enable CORS
  await app.register(cors, {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  });

  // Enable WebSocket
  await app.register(websocket);

  // OpenAPI / Swagger Documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: "IDR 26168 Fleet & Dispatch Geospatial API",
        version: "1.0.0",
        description: "High-performance geospatial API for live dead-reckoning fleet telemetry, map packs, and hazard monitoring.",
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
  });

  // Register Routes
  await app.register(healthRoutes);
  await app.register(deviceRoutes);
  await app.register(ingestRoutes);
  await app.register(liveRoutes);
  await app.register(tripRoutes);
  await app.register(eventRoutes);
  await app.register(hazardRoutes);
  await app.register(mapPackRoutes);

  // Initialize database & seed demo devices if empty
  const db = getDatabase();
  const deviceCount = (db.prepare("SELECT count(*) as count FROM devices").get() as any)?.count || 0;
  if (deviceCount === 0) {
    app.log.info("Seeding initial fleet devices...");
    const seedDevices = [
      ["DEV_MB_101", "Mumbai Logistics - Van 101", "key_hash_101", "CAR"],
      ["DEV_MB_102", "Mumbai Delivery - Bike 204", "key_hash_102", "TWO_WHEELER"],
      ["DEV_MB_103", "South Mumbai Transit - Car 305", "key_hash_103", "CAR"],
    ];

    const ins = db.prepare("INSERT INTO devices (id, name, key_hash, created_at, last_seen) VALUES (?, ?, ?, ?, ?)");
    for (const [id, name, hash] of seedDevices) {
      ins.run(id, name, hash, Date.now(), Date.now());
    }
  }

  return app;
}

async function main() {
  try {
    const server = await buildServer();
    await server.listen({ port: CONFIG.PORT, host: CONFIG.HOST });
    console.log(`\n🚀 IDR Fleet Backend running at http://${CONFIG.HOST}:${CONFIG.PORT}`);
    console.log(`📖 Swagger API Docs available at http://${CONFIG.HOST}:${CONFIG.PORT}/docs`);
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

main();
