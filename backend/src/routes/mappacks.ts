import type { FastifyPluginAsync } from "fastify";
import fs from "node:fs";
import path from "node:path";
import { CONFIG } from "../config.js";

export const mapPackRoutes: FastifyPluginAsync = async (app) => {
  // List map packs
  app.get("/v1/map-packs", async () => {
    const packsDir = CONFIG.MAP_PACKS_DIR;
    if (!fs.existsSync(packsDir)) {
      return [];
    }

    const regions = fs.readdirSync(packsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    const result = [];
    for (const reg of regions) {
      const regDir = path.join(packsDir, reg);
      const files = fs.readdirSync(regDir).map((f) => {
        const filePath = path.join(regDir, f);
        const stats = fs.statSync(filePath);
        return {
          filename: f,
          size_bytes: stats.size,
          updated_at: Math.floor(stats.mtimeMs),
          download_url: `/v1/map-packs/${reg}/${f}`,
        };
      });

      result.push({
        region: reg,
        files,
      });
    }

    return result;
  });

  // Serve binary files with HTTP range requests
  const serveRangeFile = async (filePath: string, request: any, reply: any) => {
    if (!fs.existsSync(filePath)) {
      return reply.code(404).send({ error: "File not found" });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = request.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        reply.header("Content-Range", `bytes */${fileSize}`);
        return reply.code(416).send();
      }

      const chunksize = end - start + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });

      reply.code(206);
      reply.header("Content-Range", `bytes ${start}-${end}/${fileSize}`);
      reply.header("Accept-Ranges", "bytes");
      reply.header("Content-Length", chunksize);
      reply.header("Content-Type", "application/octet-stream");

      return reply.send(fileStream);
    } else {
      reply.header("Content-Length", fileSize);
      reply.header("Accept-Ranges", "bytes");
      reply.header("Content-Type", "application/octet-stream");
      return reply.send(fs.createReadStream(filePath));
    }
  };

  app.get<{ Params: { region: string; file: string } }>("/v1/map-packs/:region/:file", async (request, reply) => {
    const { region, file } = request.params;
    // Sanitize path traversal
    const safeFile = path.basename(file);
    const filePath = path.join(CONFIG.MAP_PACKS_DIR, region, safeFile);
    return serveRangeFile(filePath, request, reply);
  });

  app.get<{ Params: { region: string } }>("/maps/:region/basemap.pmtiles", async (request, reply) => {
    const { region } = request.params;
    const filePath = path.join(CONFIG.MAP_PACKS_DIR, region, "basemap.pmtiles");
    return serveRangeFile(filePath, request, reply);
  });
};
