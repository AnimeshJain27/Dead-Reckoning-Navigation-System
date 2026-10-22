import fs from "node:fs";
import path from "node:path";

const resolveMapsDir = (): string => {
  if (process.env.MAP_PACKS_DIR) return process.env.MAP_PACKS_DIR;
  if (process.env.MAPS_DIR) return process.env.MAPS_DIR;
  const localMaps = path.resolve(process.cwd(), "maps");
  if (fs.existsSync(localMaps)) return localMaps;
  const parentMaps = path.resolve(process.cwd(), "../maps");
  if (fs.existsSync(parentMaps)) return parentMaps;
  return localMaps;
};

export const CONFIG = {
  PORT: parseInt(process.env.PORT || "8080", 10),
  HOST: process.env.HOST || "0.0.0.0",
  DB_PATH: process.env.DATABASE_PATH || process.env.DB_PATH || path.resolve(process.cwd(), "data/fleet.sqlite"),
  MAP_PACKS_DIR: resolveMapsDir(),
  ADMIN_KEY: process.env.ADMIN_TOKEN || process.env.ADMIN_KEY || "idr-admin-secret-key-26168",
};
