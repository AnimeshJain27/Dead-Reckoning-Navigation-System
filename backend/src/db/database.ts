import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { CONFIG } from "../config.js";

let dbInstance: DatabaseSync | null = null;

export function getDatabase(): DatabaseSync {
  if (!dbInstance) {
    const dir = path.dirname(CONFIG.DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    dbInstance = new DatabaseSync(CONFIG.DB_PATH);
    dbInstance.exec("PRAGMA journal_mode = WAL;");
    dbInstance.exec("PRAGMA synchronous = NORMAL;");
    dbInstance.exec("PRAGMA foreign_keys = ON;");
    initSchema(dbInstance);
  }
  return dbInstance;
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_seen INTEGER
    );

    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL REFERENCES devices(id),
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      distance_m REAL,
      dr_distance_m REAL,
      max_hpl_m REAL,
      vehicle_mode TEXT
    );

    CREATE TABLE IF NOT EXISTS states (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      t_ms INTEGER NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      speed_mps REAL,
      heading_deg REAL,
      mode TEXT NOT NULL,
      hpl_m REAL NOT NULL,
      ell_major_m REAL,
      ell_minor_m REAL,
      ell_angle_deg REAL,
      way_id INTEGER,
      match_posterior REAL,
      vehicle_mode TEXT,
      level INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_states_dev_t ON states(device_id, t_ms);
    CREATE INDEX IF NOT EXISTS idx_states_trip_t ON states(trip_id, t_ms);
    CREATE INDEX IF NOT EXISTS idx_states_lat_lon ON states(lat, lon);

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      trip_id TEXT,
      t_ms INTEGER NOT NULL,
      lat REAL,
      lon REAL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_events_dev_t ON events(device_id, t_ms);
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);

    CREATE TABLE IF NOT EXISTS road_conditions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      t_ms INTEGER NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      kind TEXT NOT NULL,
      severity REAL NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_road_cond_kind ON road_conditions(kind);
  `);
}
