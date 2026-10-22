# ADR 0001 — Gap Fills and Architecture Option Selections

- **Status:** Accepted (Frozen baseline)
- **Date:** 12 October 2026 / 21 October 2026
- **Context:** SIH 2026 · Problem Statement 26168 (ISRO) · AI-ML based Intelligent Dead Reckoning system.
- **Reference:** `docs/architecture/DOSSIER_rev69.md` and `IMPLEMENTATION_PLAN.md` §0.3.

---

## Context

The Technical Dossier (revision 69) and idea presentation content define the algorithmic core, math, and system requirements for the Intelligent Dead Reckoning (IDR) navigation system. In several places, the dossier permits architectural options or is silent on implementation details (e.g. mobile bridge mechanism, runtime neural engine, web framework, backend language). 

This ADR records the frozen decisions (amendment A, 12 October 2026) ensuring deterministic implementation across all tiers.

---

## Decisions

### A1. Neural Network Runtime: ONNX Runtime Mobile / C++ API
- **Dossier:** Export to "ONNX Runtime Mobile, or LiteRT" (§4.2).
- **Decision:** Use **ONNX Runtime (C++ API)** across Android NDK, iOS, and Linux/ROS 2.
- **Rationale:** Direct export from PyTorch (`torch.onnx.export`) without extra quantization/conversion tools required by LiteRT/TFLite. A single unified C++ runtime API for all target tiers.

### A2. Embedded Spatial Storage: SQLite Amalgamation with R*Tree
- **Dossier:** "SQLite with its R*Tree module, or SpatiaLite" (§4.5).
- **Decision:** Use **SQLite 3 amalgamation with `-DSQLITE_ENABLE_RTREE=1`**.
- **Rationale:** Avoids heavy dynamic dependencies (GEOS, PROJ) on mobile devices and edge targets. Portable across C++, Node.js (`better-sqlite3`), and Python.

### A3. Mobile Service Bridge: Kotlin Foreground Service over JNI
- **Dossier:** Flutter reaches the core "through platform channels or dart:ffi" (§4.3).
- **Decision:** Android Kotlin foreground service (`location` type) hosts `libidr_core.so` over **JNI**. Flutter communicates with the service via standard platform channels (`idr/nav`, `idr/state`, `idr/events`).
- **Rationale:** Dead reckoning must continue computing at 10 Hz even when the screen is turned off, the phone is locked, or Flutter UI is detached.

### A4. Server-Side Snapping Engine: OSRM Container
- **Dossier:** "GraphHopper or OSRM" (§4.5).
- **Decision:** **OSRM** Docker container with optional profile.
- **Rationale:** High-performance C++ implementation, no JVM overhead, isolated off the phone evaluation loop.

### A5. Mobile Map Renderer: MapLibre Native with PMTiles
- **Dossier:** Unspecified mobile map renderer.
- **Decision:** **MapLibre Native** via `maplibre_gl` (MapLibre Android 13.5+ / iOS 6.28+), loading local PMTiles via `pmtiles://file://...`.
- **Rationale:** 100% offline vector map rendering, open source, no API keys, zero tile quotas.

### A6. Vector Basemap Generation: Planetiler (OpenMapTiles Schema)
- **Dossier:** Unspecified basemap build pipeline.
- **Decision:** **Planetiler** running against Geofabrik OSM PBF extracts, emitting single-file `.pmtiles` per region. Styles derived from OpenMapTiles Positron (light) and Dark Matter (dark) with bundled glyphs and sprites.
- **Rationale:** Fast single-machine tile generation matching the matcher's exact road graph.

### A7. Web Map Dashboard: React + TypeScript + Vite + MapLibre GL JS
- **Dossier:** Unspecified web stack.
- **Decision:** **React + TypeScript + Vite + MapLibre GL JS** with `@protomaps/pmtiles` protocol support.
- **Rationale:** Modern lightweight single-page application suitable for static deployment (e.g. Vercel) and local dispatch console.

### A8. Fleet & Dispatch Backend: Node.js 24 + TypeScript + Fastify + SQLite
- **Dossier:** Unspecified backend stack.
- **Decision:** **Node.js 24 LTS + TypeScript + Fastify**, using `better-sqlite3` in WAL mode with R*Tree indexing.
- **Rationale:** Shares TypeScript schemas with the web frontend; unified spatial SQLite database model across client and server; native HTTP range-request support for serving `.pmtiles`.

### A9. Production Deployment: Docker Compose + Caddy Reverse Proxy
- **Dossier:** Unspecified hosting architecture.
- **Decision:** **Docker Compose** on Linux host with **Caddy** for automated TLS/HTTPS.
- **Rationale:** Handles WebSocket connections for live telemetry streams, range requests for map packs, and automatic Let's Encrypt certificates.

### A10. Robotics / Edge Middleware: ROS 2 Jazzy Jalisco on Ubuntu 24.04
- **Dossier:** Unspecified ROS distribution.
- **Decision:** **ROS 2 Jazzy Jalisco (LTS)** on Ubuntu 24.04 LTS.
- **Rationale:** Current LTS release targeted for Raspberry Pi 5 and Jetson platforms.

### A11. Magnetic Field Modeling: IGRF-14 Evaluator in C++
- **Dossier:** "IGRF coefficients" (§4.1), no library specified.
- **Decision:** Official IGRF-14 spherical-harmonic text coefficients (`igrf14coeffs.txt`) evaluated up to degree 13 in `core/src/geo`.
- **Rationale:** Start-up check only. Avoids heavy external GeographicLib magnetic model files.

### A12. Fast Map Matching OD Table: C++ UBODT Generator
- **Dossier:** "FMM's upper-bounded origin-destination table ... in SQLite" (§4.5).
- **Decision:** Custom C++ tool (`ubodt_gen`) computing FMM-compatible table directly from `map.sqlite` graph (bound 0.5 km).
- **Rationale:** Avoids GDAL/Shapefile dependencies; generates schema (`source, target, next_n, prev_n, next_e, cost`) directly into SQLite.

### A13. Road Network Graph Builder: Python `pyosmium` Offline Pipeline
- **Dossier:** "PBF -> directed edges" offline (§4.5).
- **Decision:** `osmium-tool` for spatial clipping + `pyosmium` for node-way parsing, topology building, and R-tree insertion into `map.sqlite`.
- **Rationale:** Reliable offline toolchain that never ships to client devices.

### A14. Device Logging Schema: Own-Log Structured Format
- **Dossier:** Required own logs for two-wheeler, car-park, and auto-rickshaw claims (§2.4, §3.2).
- **Decision:** Per-session folder containing `meta.json`, `imu.csv` (100–200 Hz), `mag.csv`, `baro.csv`, `gnss_fix.csv` (1 Hz), `gnss_status.csv`, `gnss_meas.csv`, `agc.csv`, `nmea.txt`, `markers.csv`.
- **Rationale:** Converted by `make ingest-own-logs` to the exact Parquet schema as IO-VNBD S-files, enabling unified evaluation.

### A15. Build & CI Tooling: CMake, uv, pnpm
- **Dossier:** GoogleTest + replay harness "on every commit" (§4.1).
- **Decision:** CMake 3.28+ (C++ core, shared by NDK and ROS 2 ament), `uv` (Python 3.11 ML pipeline), `pnpm` (TypeScript backend, web, and contracts), GitHub Actions CI.

### A16. Path Ahead & Routing: Matched Road Corridor Continuation
- **Dossier:** Map matching only (§4).
- **Decision:** No turn-by-turn routing engine. The "path ahead" is defined by the matched edge and its forward continuation to the next major topological junction.
- **Rationale:** Directly feeds tunnel-ahead pre-arming without adding unnecessary routing engine complexity.

---

## Consequences
- Every tier has a fixed, pinned runtime and toolchain.
- No external runtime network dependencies are required for offline navigation.
- All spatial and telemetry data are unified on WGS-84 coordinates and SQLite R*Tree indexing.
