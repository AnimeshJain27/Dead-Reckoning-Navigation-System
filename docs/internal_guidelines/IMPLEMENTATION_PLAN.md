# IDR 26168 — Implementation Plan

SIH 2026 · PS 26168 (ISRO) · AI-ML based Intelligent Dead Reckoning system for seamless navigation
Plan v1.2 · 13 October 2026 (v1.1: audited line by line against dossier rev 69; v1.2: setup matched to the team's existing repo and Windows folder) · lead developer & core team · approvals: team

**Source of truth.** `docs/architecture/DOSSIER_rev69.md` (Technical Dossier, revision 69, frozen) and `docs/architecture/PPT_CONTENT_final.md` (submitted idea content, which adds the decided app features). `docs/architecture/reference/RESEARCH_DOSSIER_phase2_usps.md` is cited by the dossier for USP 3 and USP 4 only; where it disagrees with the dossier, the dossier wins.

**How this plan treats the architecture.** Every component below maps to a dossier section (the "Dossier" columns). Where the dossier lists two options, §0.3 records which one is built. Where the dossier is silent (web app, fleet backend, map renderer, hosting, ROS 2 distribution), §0.3 records the single most feasible choice that fits the dossier, as a dated amendment. Nothing in the dossier is changed. Anything not covered here needs the team's written approval before it is built.

---

## 0. Baseline

### 0.1 What gets built

| Tier | Component | Dossier | Directory |
|---|---|---|---|
| Navigation core, C++20 | M1 alignment and dynamic calibration with mount-slip gating | §2.2, §3.1 | `core/src/alignment` |
| | M2 P-AIVE: front end (Hampel, 4 Hz Butterworth, envelopes, shock flag), speed TCN runner, GLRT stop detector, ZUPT/ZARU, reverse detector | §2.1, §3.2 | `core/src/frontend`, `core/src/paive` |
| | M3 NHC rows and HMM map-matcher over OSM, map-offset state, junction anchors, re-convergence prior, curvature matching and helical-ramp floor counting (research dossier USP 3) | §2.3, §3.3 | `core/src/mapmatch` |
| | M4 right-invariant IEKF on SE₂(3), 23 states (+ optional 24th), map-free shadow filter, noise-adapter runner, deficit handler, interference monitor, protection level | §2.1, §3.4 | `core/src/filter`, `core/src/integrity` |
| | Two-wheeler mode: SPRT, lean compensation, slide gate, lever arm | §2.4 | `core/src/vehicle_mode` |
| | Phones without a gyroscope: accelerometer-only speed variant, map-heading fallback, on-screen notice | §5.5 | `core/src/engine` |
| ML pipeline, Python (offline only) | IO-VNBD loaders, S/V sync, labels, outage simulator, Stage 1 (speed TCN), Stage 2 (noise adapter through the unrolled IEKF), ONNX export, evaluation | §2.1, §4.2, §5.4, §7.1 | `ml/` |
| Offline map engine | OSM PBF → directed edges with oneway, lanes, layer, bridge, tunnel → SQLite R-tree + upper-bounded OD table (0.5 km) | §3.3, §4.5 | `maps/`, `core/tools/ubodt_gen` |
| Mobile app | Flutter UI; Android Kotlin + NDK sensors at 100–200 Hz; GnssStatus, NMEA, GnssMeasurement, NavIC (IRNSS); iOS Core Motion + Objective-C++ | §4.3 | `mobile/` |
| Integration SDK | Android and iOS library for delivery, ride-hailing and emergency apps | PPT slide 3, architecture flow | `sdk/` |
| Fleet and dispatch | live position with its protection level, interference event log | PPT slides 4–5, architecture flow | `backend/`, `web/` |
| Edge unit | ROS 2 on Raspberry Pi 5 or Jetson, 200 Hz IMU, u-blox with DR assistance | §4.4, §5.3 | `edge/` |

App features decided in the PPT content: tunnel-ahead pre-arming from OSM tags · jamming and spoofing alerts · trust display (mode, uncertainty circle, NavIC satellites in view) · saved vehicle profiles · per-road map-offset memory · optional barometer row (flyover vs road beneath, 6–8 m ≈ 0.7–1 hPa; parking floors) · pothole and speed-breaker map from the vibration detector. UI reference: `docs/design/app_concepts/` (Drive, tunnel DR, car park, jamming, satellites and trust).

### 0.2 Rules carried into every phase (also in `ENGINEERING_GUIDELINES.md`)

1. **Architecture freeze.** Algorithms, parameters, libraries and data flow are the dossier's. No substitutions.
2. **Data boundary.** IO-VNBD (github.com/onyekpeu/IO-VNBD, the dataset the brief cites) is the only dataset for training, calibration and benchmarking. The architecture's own inputs are also used:
   - OSM extracts (map engine and basemap).
   - IGRF-14 coefficients (start-up heading prior).
   - The team's own logger sessions (two-wheeler, car-park and auto-rickshaw claims, which IO-VNBD cannot cover).

   Nothing else is introduced. Test traffic for the backend and web is IO-VNBD replayed through the real engine, never synthetic data. The only derived data are the IO-VNBD transforms the dossier itself specifies, and they are labelled as such in every report: simulated outages (§5.4), injected mount rotations (§2.2), and two-wheeler runs built from Fiesta trajectories (§2.4). The tightly coupled path is deferred, because its test data (GSDC 2023) is outside the boundary (§3.4, optional).
3. **Results.** Only numbers produced by code in this repo, with a run ID, are results. Dossier budgets stay labelled as budgets until a measured value replaces them.
4. **Engineering values.** Numbers marked **(E)** are this plan's own choices: tolerances, margins, protocol sizes and test thresholds. They are not dossier parameters. They may be tuned with a note in `docs/decisions/`; dossier parameters may not.

### 0.3 Gap fills and option selections (amendment A, 12 October 2026)

| ID | Dossier says | Built as | Why this is the most feasible fit |
|---|---|---|---|
| A1 | Export to "ONNX Runtime Mobile, or LiteRT" (§4.2) | ONNX Runtime, C++ API on Android NDK, iOS and Linux/ROS 2 | Direct `torch.onnx.export`; one runtime API for all three tiers. LiteRT would need an extra conversion step. |
| A2 | "SQLite with its R*Tree module, or SpatiaLite" (§4.5) | SQLite amalgamation with `SQLITE_ENABLE_RTREE` | No GEOS/PROJ dependency on the phone; the same engine serves the backend (A8) |
| A3 | Flutter reaches the core "through platform channels or dart:ffi" (§4.3) | Kotlin foreground service hosts the core over JNI; Flutter uses platform channels | Navigation must keep running with the screen off and the UI detached |
| A4 | Server-side option "GraphHopper or OSRM" (§4.5) | OSRM container, optional profile | Prebuilt image, no JVM; off the phone loop, as the dossier says |
| A5 | No map renderer named | MapLibre Native through `maplibre_gl` (0.27.x bundles MapLibre Android 13.5 / iOS 6.28), reading a local PMTiles basemap (`pmtiles://file://…`, supported since MapLibre Android 11.7) | Offline, open source, no API keys or tile quotas; same renderer family on web (A7) |
| A6 | No basemap pipeline named | Planetiler, OpenMapTiles schema, one PMTiles file per region built from the same OSM extract | The display uses the same OSM snapshot as the matcher. Styles are derived from OpenMapTiles Positron (light) and Dark Matter (dark) to match the concept screens; glyphs and sprites are bundled. |
| A7 | No web stack named | React + TypeScript + Vite + MapLibre GL JS with the `pmtiles` protocol; static build on the existing Vercel project | Static SPA fits Vercel; shares styles and tiles with the app |
| A8 | No fleet backend named | Node.js 24 LTS + TypeScript + Fastify. REST with JSON/GeoJSON; WebSocket live feed; SQLite (WAL) with R*Tree. It also serves map packs and PMTiles with HTTP range requests. | §4 keeps Python on the training side only. One language with the web, and one spatial engine with the device. |
| A9 | No hosting for the backend | Docker Compose on one Linux host, Caddy for automatic HTTPS | Vercel serves HTTPS, so the API must too; Vercel functions cannot hold WebSockets |
| A10 | ROS 2, no distribution | Jazzy Jalisco (LTS) on Ubuntu 24.04 | Current LTS, runs on Raspberry Pi 5 |
| A11 | "IGRF coefficients" (§4.1), no library | IGRF-14 text coefficients (NOAA NCEI) with a degree-13 spherical-harmonic evaluator in `core/src/geo` | Start-up use only; avoids depending on a GeographicLib magnetic dataset |
| A12 | "FMM's upper-bounded origin–destination table … in SQLite" (§4.5) | FMM's algorithm and table layout (`source, target, next_n, prev_n, next_e, cost`, bound 0.5 km), emitted by our C++ tool from the SQLite graph | FMM's own `ubodt_gen` needs a GDAL shapefile network; the table is identical |
| A13 | "PBF → directed edges" offline (§4.5), no tool | `osmium extract` (clip) + Python `pyosmium` graph builder | Offline only; Python never ships to devices or servers |
| A14 | Own logs required (claims table, §2.4, §3.2), no format | Logger mode in the app, per-session CSV + `meta.json` (§2.6), converted to IO-VNBD's phone schema | One loader and one evaluation harness for both sources |
| A15 | GoogleTest + replay harness "on every commit" (§4.1), no CI or build tools named | CMake (shared by NDK and ament_cmake); `uv` (Python); `pnpm` workspaces (web, backend, contracts); GitHub Actions | The repo is on GitHub. Replay runs on a session subset per commit and on everything nightly. |
| A16 | No routing engine (map matching only, §4) | No turn-by-turn routing is added | The "path ahead" on the map is the matched edge and its continuation to the next junction, which is what tunnel pre-arming reads |

Deferred under the rules above:
- The tightly coupled Doppler and pseudorange path (§3.4 optional; needs GSDC). Raw GnssMeasurement is still logged.
- iOS, if no Mac is available (C6).
- Edge hardware runs, if no hardware is available (C5).

---

## 1. Data intake and human handoff

### 1.1 Mandated dataset: IO-VNBD

Repository named in the brief: `https://github.com/onyekpeu/IO-VNBD` (Onyekpe et al., *Data in Brief*, 2021). Checked on 12 October 2026: the data sits in the repository as Git LFS objects (`.gitattributes` tracks `*.csv`, `*.zip`, `*.jpg`); no external host.

| File (exact name in the repo) | Content | Put it in |
|---|---|---|
| `Synchronised V abd S datasets.zip` (spelling as in the repo) | V and S sessions recorded together, aligned by hand by the authors | `data/raw/io-vnbd/` |
| `Unsynchronised V and S Dataset.zip` | all V and S sessions | `data/raw/io-vnbd/` |
| `README_1.pdf` | dataset documentation: headers, units, scenario labels | `data/raw/io-vnbd/` |
| inside the archives | the GPS-outages file, the 32 labelled scenarios, tyre-pressure configurations | unpacked by `make data` |

Schemas (dossier §7.1; exact header strings are confirmed against `README_1.pdf` in Phase 1):

- **V files (vehicle):**
  - Hardware: Ford Fiesta Titanium (front-wheel drive), Racelogic VBOX Video HD2 CAN logger and GPS antenna. CAN and GPS at 10 Hz. England, about 40 h and 1,300 km.
  - 29 columns: GPS satellites, time of day, latitude, longitude, velocity (km/h), heading, height, vertical velocity, sample period, steering angle, four wheel speeds (rad/s), yaw rate (deg/s), indicated speed (km/h), indicated longitudinal and lateral acceleration (g), handbrake, gear requested, gear employed (1–5), engine speed (rpm), coolant temperature, clutch, brake pressure (psi), brake switch, battery voltage, air temperature, accelerator position (%).
- **S files (smartphone):**
  - Hardware: Huawei P20 Pro, Motorola Moto G7 Power, BlackBerry Priv running AndroSensor, in a Fiesta, Volvo XC70, Renault Mégane and Toyota Corolla Verso. IMU at 10 Hz, GPS at 1 Hz. England, France and Nigeria, about 58 h and 4,400 km.
  - 24 columns: GPS latitude, longitude, altitude (m), speed (km/h), accuracy (m), orientation (deg), satellites in range; time since start (ms); date; accelerometer X/Y/Z (m/s²); gravity X/Y/Z (m/s²); gyroscope yaw/pitch/roll (rad/s, phone axes); magnetic field X/Y/Z (µT); orientation yaw/pitch/roll (deg).

**Who fetches it.** I pull the LFS objects at the start of Phase 0 and record SHA-256 checksums. If the pull fails, typically because the owner's LFS bandwidth quota is exhausted or a proxy blocks `media.githubusercontent.com`, run this on any machine with Git and Git LFS, from a folder outside our repo (e.g. Downloads), then tell me:

```powershell
git lfs install
git clone https://github.com/onyekpeu/IO-VNBD.git
cd IO-VNBD
git lfs pull
$repo = "D:\path\to\your\repo"          # our repo clone; data/ is gitignored
$dst = "$repo\data\raw\io-vnbd"
New-Item -ItemType Directory -Force $dst | Out-Null
Copy-Item "Synchronised V abd S datasets.zip","Unsynchronised V and S Dataset.zip","README_1.pdf" $dst
Get-FileHash -Algorithm SHA256 "$dst\*" | Format-Table -AutoSize
```

If `git lfs pull` also fails: open each file's page on GitHub, use **Download raw file**, and send the three files.

### 1.2 Architecture inputs (not datasets)

| Input | Exact source | Used by | Fetch |
|---|---|---|---|
| OSM extracts covering the IO-VNBD routes | Geofabrik extracts for the England sub-regions that contain the V/S session bounding boxes, plus the France regions and Nigeria for the S sessions. The exact file list is generated by `make regions` (task 1.9) from the sessions' GPS columns. | Matching evaluation; fits of β, σ_map, w_e, L_m (§2.3, §3.3) | I fetch; fallback: you download the generated list |
| OSM extract for the India demo | `https://download.geofabrik.de/asia/india/western-zone-latest.osm.pbf` (≈210 MB). Expected to contain Maharashtra; task 1.9 checks that the Mumbai Coastal Road tunnel lies inside before building. Optional `northern-zone-latest.osm.pbf` (≈213 MB) for the Atal Tunnel. | App map packs, tunnel pre-arming, console basemap | I fetch |
| Planetiler auxiliary layers | OSMData water polygons and Natural Earth, downloaded by Planetiler's `--download` | Display basemap only; never read by navigation code | I fetch |
| IGRF-14 | `https://www.ngdc.noaa.gov/IAGA/vmod/coeffs/igrf14coeffs.txt` | M1 start-up heading prior: declination, field and dip gates (§3.1) | I fetch |
| Own logs | Recorded with the app's logger mode (format §2.6, protocols in Phase 4) | Two-wheeler speed head, car-park claim, autos, phone Allan deviation (§2.4, §3.2, claims table) | You record; I validate and ingest |

Fallback for OSM and IGRF if my downloads are blocked:

```powershell
$repo = "D:\path\to\your\repo"
$osm = "$repo\data\raw\osm"; New-Item -ItemType Directory -Force $osm | Out-Null
Invoke-WebRequest https://download.geofabrik.de/asia/india/western-zone-latest.osm.pbf -OutFile "$osm\western-zone-latest.osm.pbf"
$igrf = "$repo\data\raw\igrf"; New-Item -ItemType Directory -Force $igrf | Out-Null
Invoke-WebRequest https://www.ngdc.noaa.gov/IAGA/vmod/coeffs/igrf14coeffs.txt -OutFile "$igrf\igrf14coeffs.txt"
```

### 1.3 Environment, access and credentials

| Item | Needed for | Who provides | By |
|---|---|---|---|
| Your existing GitHub repository (kept private), with this folder's contents at its root; the code session needs push access | everything | you | Phase 0 |
| Network access from the code environment to `github.com`, `media.githubusercontent.com`, `download.geofabrik.de`, `www.ngdc.noaa.gov`, `osmdata.openstreetmap.de`, `naciscdn.org`, `pypi.org`, `download.pytorch.org`, `registry.npmjs.org`, `pub.dev`, `dl.google.com`, `maven.google.com`, `repo.maven.apache.org`, `packages.ros.org`, Docker Hub, `ghcr.io` | data, toolchains | you, only if a proxy blocks any of them | Phase 0 |
| Vercel: re-link the existing project (the placeholder site) to this repo, Root Directory `web/`, set `VITE_*` variables (§4.2). The production address stays the same. If this repo already deploys the placeholder, the placeholder moves under `web/` in Phase 0 and the Root Directory switch happens then, so the live site never breaks. | web console | you click; I write `web/vercel.json` and the values | Phase 3 (Phase 0 if the repo already deploys it) |
| Backend host: Linux VM with Docker, a DNS name (e.g. `api.<your-domain>`), ports 80/443 open | fleet API, map packs, console data | you | Phase 2B |
| Secrets (generated, never committed): `ADMIN_TOKEN`, `DEVICE_KEY_PEPPER`, one key per test phone | backend, app | I generate with `make secrets`; you store them | Phase 2B |
| Android release keystore + `mobile/android/key.properties` | signed APK | you create (command in `docs/setup/MOBILE.md`); stays on your machine | Phase 4 |
| Apple developer account + a Mac with Xcode | iOS app and iOS SDK | you, if available | Phase 4 |
| Map or tile API keys | — | none needed: tiles are built from OSM (A5, A6) | — |

### 1.4 Clarification points (each has a default so nothing stalls)

| # | Question | Default if not answered at gate G0 |
|---|---|---|
| C1 | Demo region(s) | Mumbai (Western Zone). Add the Northern Zone for the Atal Tunnel only on request. |
| C2 | Test phones: model, Android version, gyroscope and barometer present, NavIC (L5) chipset, GnssMeasurement and AGC support (GPSTest screenshots and an adb sensor list, per `docs/setup/ENVIRONMENT.md`) | Need at least one Android 12+ phone with a gyroscope. Until then the UI runs on IO-VNBD replay only. |
| C3 | Where the code session runs | Your Windows laptop, repo in a folder on D:. `make` and Docker run from WSL2 Ubuntu 24.04 (Docker Desktop's WSL integration), with build trees, node_modules and caches in Docker volumes. Flutter and the Android SDK run on Windows so adb reaches the phone over USB. About 60 GB free. A cloud workspace uses the same containers. |
| C4 | NVIDIA GPU visible to PyTorch (WSL2 CUDA) | CPU training. Both models total 23,367 parameters; Stage 2 is slower but feasible. |
| C5 | Edge hardware: Pi 5 (8 GB) or Jetson; IMU make, model and interface (UART or CAN); u-blox model (raw-capable) | Edge tier built and verified on IO-VNBD replay only |
| C6 | Mac + Xcode + Apple account | Android first; iOS code written and compiled only if a macOS runner is available |
| C7 | Number of phones in the fleet demo | 50 (sizes the load test) |
| C8 | IO-VNBD licence: the repository has no LICENSE file | Use for research and evaluation, citing Onyekpe et al., *Data in Brief* 2021 |
| C9 | Two-wheeler mount | Chassis-fixed holder (apron or stem); handlebar mounts are outside the drift claims (§2.4) |

---

## 2. Data ingestion and preprocessing (IO-VNBD, OSM, own logs)

### 2.1 Execution split

| Work | Runs in | Who |
|---|---|---|
| Download, checksum and unpack IO-VNBD, OSM, IGRF | code environment | me (you only on the §1 fallbacks) |
| Canonicalise, sync, label, calibrate, split, index outages | code environment (`ml/`, `core/tools`) | me |
| Map graph, R-tree, UBODT, PMTiles, map packs | code environment (`maps/` container) | me |
| Training, export, evaluation | code environment (CPU, or your GPU per C4) | me |
| Phone installs, field logging, on-device benchmarks | your phones | you, with exact `adb` commands from me |
| Backend deploy, Vercel settings, DNS | your accounts | you, with exact commands from me |

Every step is a `make` target (§4.3), so either side can re-run it, and outputs are deterministic for a given seed and input checksum.

### 2.2 IO-VNBD → canonical sessions (`ml/idr_ml`, `core/tools`)

| Step | What happens | Dossier | Output |
|---|---|---|---|
| 2.2.1 Inventory | Unpack the archives. Build a manifest of file, session ID, V or S, vehicle, phone, country, rows, duration, distance, scenario labels and CAN availability. | §7.1 | `data/interim/io-vnbd/manifest.parquet` |
| 2.2.2 Parse and rename | Headers → snake_case per the data dictionary. Units to SI (km/h → m/s, g → m/s², deg/s → rad/s); wheel speeds kept in rad/s; source units recorded. | §7.1 | `data/interim/io-vnbd/{V,S}/<session>.parquet` |
| 2.2.3 Timestamps | V: time of day + sample period → monotonic seconds. S: ms since start → seconds. Duplicated or missing rows are filled linearly when the gap is ≤ 2 samples; longer gaps split the session. | §3.2 step 1 | same files, `t_s` |
| 2.2.4 GNSS cleaning | Rows with lat/lon = 0 are flagged as no-fix. Accuracy is kept as `r68_m`, with the satellite count. Nothing else is dropped: the §3.4 pre-checks run inside the engine during replay, as on a device. | §3.4 | |
| 2.2.5 S/V synchronisation | Yaw-rate cross-correlation in 120 s windows, parabolic sub-sample peak, Huber fit τ(t) = τ₀ + εt. Rates resampled through their integrals. | §7.1 | `data/processed/sync/<pair>.json` + QA plots |
| 2.2.6 Truth | VBOX 10 Hz position, heading and velocity → ENU per session (GeographicLib LocalCartesian) | §4.1 | `data/processed/truth/` |
| 2.2.7 Labels | Speed labels on the synchronised Fiesta sessions from the undriven rear wheels, with effective radius r̂ fitted per session over set 𝒦. Drop braking above 0.3 g. Stop labels from V's CAN: all four wheel speeds at 0, with the brake, handbrake and rpm channels (§5.2 table) recorded per stop. Engine-on stops (rpm > 0) are indexed for the GLRT noise fit and the fold test. Phone-GPS weak labels at 1 Hz on the Volvo, Mégane and Corolla sessions where accuracy ≤ 10 m. | §2.1, §3.2, §5.2 | `data/processed/labels/` |
| 2.2.8 Calibration fits | Ceres tools: Allan deviation per phone model from long engine-on stops; Wahba mount truth per session from CAN accelerations and yaw rate. Also fitted: NHC σ₀, c and σ_up; GNSS velocity noise against V's 10 Hz GPS; a_max and j_max (99.9th percentiles); σ_c; the GLRT's σ_a and σ_ω from V's engine-on stops, not datasheets; the slide gate's σ_ν from driving outside the skid and drift files. | §2.1, §2.4, §3.1–§3.4 | `data/processed/calibration/*.json` |
| 2.2.9 Fold test | On Fiesta idling stretches, compare phone accelerometer spectra with rpm orders. The result decides the device acquisition chain (decimate-then-10 Hz-Butterworth or 200 Hz-Butterworth-then-decimate). | §3.2 step 5 | `docs/decisions/0002-acquisition-chain.md` |
| 2.2.10 Splits | By session. Held-out scenario classes: the wet, dirt and gravel files V-Vta and V-Vtb. The S-only sessions (Volvo, Mégane, Corolla) are split by session too: their training sessions supply the phone-GPS weak labels (§2.1), and their test sessions carry the §5.2 proof 2 score against phone GPS. | §2.1, §5.2 | `data/processed/splits.json` (frozen, seed 26168) |
| 2.2.11 Outage index | 10 s outages on V-Vw12, V-Vta11, V-Vfb02d, V-Vw16b, V-Vw17, V-Vw6/7/8 and V-Vtb8/11/13; 30, 60, 120 and 180 s slid through whole files. Stage-2 windows are 60 s of GNSS followed by an outage at a random position. | §2.1, §5.4 | `data/processed/outages.parquet` |

### 2.3 Coordinates and spatial normalisation

- **Storage CRS:** WGS-84 geographic (EPSG:4326) everywhere. IO-VNBD GPS, OSM and phone fixes all use it (§4.1).
- **Computation frame:** a local ENU tangent plane from GeographicLib LocalCartesian. It is re-anchored every 5 km, with the Ad_T covariance transform (§3.4). HMM distances and the map cross-track row live in this plane.
- **Display CRS:** Web Mercator (EPSG:3857) exists only inside the PMTiles pyramid and the two renderers. No computation reads it.
- **Conventions:** ENU yaw = π/2 − compass heading (§3.4). Phone-axis mapping from AndroSensor columns is documented in the data dictionary. Units are SI internally. The map database stores degrees × 10⁷ as integers.
- **OSM cleaning and repair** (task 1.9, tool A13):
  - Keep the §3.3 highway classes plus `*_link` and `service` (including `parking_aisle`, used inside car parks).
  - Split ways at shared nodes into directed edges; remove repeated nodes and zero-length segments.
  - `oneway`: yes/1/true forward, −1 reversed. `junction=roundabout` ⇒ oneway.
  - `lanes`: integer, or the larger value of "a;b". `width = lanes × 3.5 m` (IRC:SP:73), otherwise a per-class default.
  - `layer` defaults to 0. `bridge` and `tunnel` are flags, with `tunnel=culvert` excluded.
  - Clip to the region box + 2 km **(E)** with `osmium extract -b`, then recompute lengths and headings.
  - Report strongly connected components; flag isolated islands.
  - Merge contiguous tunnel edges into tunnel objects, with length and both portals, for pre-arming.

### 2.4 Device map database: `data/maps/<region>/map.sqlite` (read-only on the phone)

```sql
CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
-- region, osm_source, osm_timestamp, bbox_e7, builder_version, ubodt_bound_m=500, lane_width_m=3.5
CREATE TABLE nodes(id INTEGER PRIMARY KEY, osm_id INTEGER NOT NULL, lat_e7 INTEGER NOT NULL, lon_e7 INTEGER NOT NULL);
CREATE TABLE edges(                       -- directed edges (§3.3 graph table)
  id INTEGER PRIMARY KEY, way_id INTEGER NOT NULL, u INTEGER NOT NULL, v INTEGER NOT NULL,
  highway TEXT NOT NULL, oneway INTEGER NOT NULL, lanes INTEGER, width_m REAL NOT NULL,
  layer INTEGER NOT NULL DEFAULT 0, bridge INTEGER NOT NULL DEFAULT 0, tunnel INTEGER NOT NULL DEFAULT 0,
  length_m REAL NOT NULL, heading_start_deg REAL NOT NULL, heading_end_deg REAL NOT NULL,
  name TEXT, geom BLOB NOT NULL);         -- delta-encoded int32 lat/lon e7 polyline
CREATE TABLE segments(id INTEGER PRIMARY KEY, edge_id INTEGER NOT NULL, idx INTEGER NOT NULL);
CREATE VIRTUAL TABLE segments_rtree USING rtree(id, min_lat, max_lat, min_lon, max_lon);  -- "R-tree over edge segments"
CREATE TABLE ubodt(source INTEGER NOT NULL, target INTEGER NOT NULL, next_n INTEGER NOT NULL,
  prev_n INTEGER NOT NULL, next_e INTEGER NOT NULL, cost REAL NOT NULL,
  PRIMARY KEY(source, target)) WITHOUT ROWID;                                            -- bound 0.5 km (A12)
CREATE TABLE junctions(node_id INTEGER PRIMARY KEY, degree INTEGER NOT NULL);
CREATE TABLE tunnels(id INTEGER PRIMARY KEY, edge_ids TEXT NOT NULL, way_ids TEXT NOT NULL, length_m REAL NOT NULL,
  portal_a_lat_e7 INTEGER, portal_a_lon_e7 INTEGER, portal_b_lat_e7 INTEGER, portal_b_lon_e7 INTEGER, name TEXT);
CREATE INDEX edges_way ON edges(way_id); CREATE INDEX edges_u ON edges(u); CREATE INDEX edges_v ON edges(v);
```

Per-user state lives in a separate writable `user.sqlite` on the phone, so map packs stay replaceable:
- `map_offsets(region, way_id, b_m, var_m2, passes, updated_at)` (per-road memory, §2.3 + PPT)
- `region_map_params(region, sigma_map_m, l_m_m, width_defaults_json, n_fixes, updated_at)`: σ_map, L_m and the per-class default widths w_e, refitted from the app's own open-sky fixes (§2.3: "fitted per region … on the app's own open-sky fixes in deployment"); the pack's values are the starting point
- `vehicle_profiles`
- `trips`
- `events`
- `road_conditions`
- `outbox`

Candidate search converts r_t from metres to a lat/lon box at the query latitude. The R-tree's float32 rounding is outward, so no candidate is lost.

Acceptance per pack:
- Connectivity report.
- Oneway sanity: no transition against a one-way edge gets non-zero probability.
- India pack only: the tunnel table includes the Mumbai Coastal Road tunnels.
- UBODT row count and file size recorded in `region.json`. The bound stays 0.5 km, so packs are cut at city scale if size demands it.

### 2.5 Basemap tiles and map packs (A5, A6)

```bash
java -Xmx8g -jar planetiler.jar --download \
  --osm-path=data/raw/osm/western-zone-latest.osm.pbf --bounds=<minlon,minlat,maxlon,maxlat> \
  --output=data/maps/western-zone/basemap.pmtiles
```

- Vector tiles z0–14 in the OpenMapTiles schema.
- Styles `maps/styles/idr-light.json` and `idr-dark.json` (from Positron and Dark Matter) highlight tunnels (`brunnel=tunnel`) and bridges.
- Glyphs (Noto Sans PBF ranges) and sprites live under `maps/styles/assets/`.
- Attribution "© OpenStreetMap contributors, © OpenMapTiles" is always shown.
- A map pack is `region.json` (version, bbox, osm_timestamp, sha256 and size of each file) + `map.sqlite` + `basemap.pmtiles`. The backend publishes packs; the app downloads and verifies them, or they are sideloaded with `adb push` for demos.

### 2.6 Own-log format (A14), written by the app's logger mode

```
logs/<yyyymmdd-hhmmss>_<device>_<vehicle>/
  meta.json        phone model, Android version, sensor list (vendor, max rate), mount type, vehicle type, protocol id, notes
  imu.csv          t_ns, ax, ay, az [m/s²], gx, gy, gz [rad/s, uncalibrated], gbx, gby, gbz [driver bias estimate]
  mag.csv          t_ns, mx, my, mz [µT, calibrated sensor: what the engine uses]; ux, uy, uz, bx, by, bz [uncalibrated + hard-iron estimate, logged only]
  baro.csv         t_ns, p_hpa
  gnss_fix.csv     t_ns, utc_ms, lat, lon, alt_m, speed_mps, bearing_deg, r68_m, n_sats, provider
  gnss_status.csv  t_ns, svid, constellation, cn0_dbhz, elev_deg, az_deg, used_in_fix, carrier_hz
  gnss_meas.csv    raw GnssMeasurement fields (logged for the deferred tightly coupled path)
  agc.csv          t_ns, constellation, carrier_hz, agc_db
  nmea.txt         raw NMEA (GSA for DOPs)
  markers.csv      t_ns, label (portal_in, portal_out, ramp_start, bay_reached, floor_change), surveyed lat/lon if known
```

`t_ns` is the sensor event timestamp on the elapsed-realtime clock (§4.3). `make ingest-own-logs` converts sessions to the same Parquet schema as IO-VNBD's S files, plus the extra channels.

### 2.7 Fleet database (backend, A8): `fleet.sqlite`, WAL mode

```sql
CREATE TABLE devices(id TEXT PRIMARY KEY, name TEXT NOT NULL, key_hash TEXT NOT NULL, created_at INTEGER NOT NULL, last_seen INTEGER);
CREATE TABLE trips(id TEXT PRIMARY KEY, device_id TEXT NOT NULL REFERENCES devices(id), started_at INTEGER NOT NULL,
  ended_at INTEGER, distance_m REAL, dr_distance_m REAL, max_hpl_m REAL, vehicle_mode TEXT);
CREATE TABLE states(id INTEGER PRIMARY KEY, trip_id TEXT NOT NULL, device_id TEXT NOT NULL, t_ms INTEGER NOT NULL,
  lat REAL NOT NULL, lon REAL NOT NULL, speed_mps REAL, heading_deg REAL, mode TEXT NOT NULL, hpl_m REAL NOT NULL,
  ell_major_m REAL, ell_minor_m REAL, ell_angle_deg REAL, way_id INTEGER, match_posterior REAL, vehicle_mode TEXT, level INTEGER);
CREATE INDEX states_dev_t ON states(device_id, t_ms); CREATE INDEX states_trip_t ON states(trip_id, t_ms);
CREATE VIRTUAL TABLE states_rtree USING rtree(id, min_lon, max_lon, min_lat, max_lat);
CREATE TABLE events(id INTEGER PRIMARY KEY, device_id TEXT NOT NULL, trip_id TEXT, t_ms INTEGER NOT NULL,
  lat REAL, lon REAL, type TEXT NOT NULL, payload TEXT NOT NULL);           -- JSON: cn0_median, agc_db, cusum, constellations, ...
CREATE VIRTUAL TABLE events_rtree USING rtree(id, min_lon, max_lon, min_lat, max_lat);
CREATE TABLE road_conditions(id INTEGER PRIMARY KEY, device_id TEXT NOT NULL, t_ms INTEGER NOT NULL,
  lat REAL NOT NULL, lon REAL NOT NULL, kind TEXT NOT NULL, magnitude REAL NOT NULL, speed_mps REAL);
CREATE VIRTUAL TABLE road_conditions_rtree USING rtree(id, min_lon, max_lon, min_lat, max_lat);
CREATE TABLE map_packs(region TEXT NOT NULL, version TEXT NOT NULL, file TEXT NOT NULL, bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL, built_at INTEGER NOT NULL, PRIMARY KEY(region, version, file));
```

**Event types.** Mode transitions from the §3.4 state table are `GNSS_OK`, `DEGRADED`, `DR`, `REACQ` and `SUSPECT_RF`. Further types: `JAMMING_SUSPECTED` (C/N0 falls on all satellites while the AGC moves), `HPL_ALERT` (HPL above the alert limit, default 20 m), `MOUNT_MOVED`, `VEHICLE_MODE`, `TUNNEL_AHEAD`, `FLOOR_CHANGE`.

**Road-condition kinds.** `POTHOLE` and `SPEED_BREAKER`, from the shock flag and the envelope (§2.1, §3.2). States older than `STATE_RETENTION_DAYS` (default 30) are deleted.

---

## 3. Implementation of the locked architecture

### 3.1 Navigation core (`core/`, C++20, Eigen3, GeographicLib, SQLite, ONNX Runtime; Ceres offline only)

| Module | Dossier | Build | Verified by |
|---|---|---|---|
| `lie/` SO(3), SE₂(3) exp/log/adjoint (AI-IMU formulas) | §4.1 | header-only, fixed sizes | GoogleTest against numeric Jacobians |
| `geo/` LocalCartesian wrapper, 5 km re-anchoring with Ad_T, Geodesic, IGRF-14 evaluator | §3.4, §4.1, A11 | | unit tests; IGRF against NOAA reference values |
| `frontend/` trailing Hampel (K=2 @10 Hz, K=20 @200 Hz, n_σ=3), shock flag (0.5 s skip of NHC and speed, Q inflation), 4th-order Butterworth 4 Hz (two SOS, bilinear), log-envelopes (M=10), decimation per 0002 | §3.2 | streaming, allocation-free | parity with the Python mirror (`ml/idr_ml/features`) within 1e-6 relative **(E)** |
| `alignment/` (M1): up direction at first stop, sign-resolved forward axis from turns, PCA, Wahba, mount refinement as an IEKF state; slip statistics (tilt, CUSUM, flutter) and states UNALIGNED/COARSE/ALIGNED/SUSPECT/MOVED; magnetometer start-up prior with IGRF gates; vehicle-profile warm start | §2.2, §3.1 | | yaw error against Wahba truth below 2° within 60 s or 3 turns; injected 15°/45°/90° slips: detection delay, time back below 3°, false alarms per hour; yaw-only injections |
| `paive/` (M2): speed TCN runner (input 1×6×30, μ = softplus, log σ² clipped to [log 0.05², log 5²]), streaming cache, fused at 1 Hz with R = α₃ κ̂ (W/S) e^{s_k}; GLRT stop detector (W=10, γ=8.60; W=100, γ=6.81) with creep gates; ZUPT every 100 ms, ZARU per disjoint window; reverse detector | §2.1, §3.2 | ONNX Runtime C++ session, 1 thread | parity with PyTorch < 1e-5 **(E)**; stop recall; false stops per km at 0.5–3 m/s |
| `vehicle_mode/`: Wald SPRT on turn samples (α=β=0.01, ±4.6, K_φ = 4.5 deg/g), mount-free statistic before ALIGNED, lean compensation of the up tracker, rear-contact lever arm, heading-frame slide gate | §2.4 | | no IO-VNBD car session ends in two-wheeler mode; car roll slope outward within 3–6 deg/g |
| `filter/` (M4): IEKF with 23 error states (ξ_R, ξ_v, ξ_p, δb_ω, δb_a, ξ_bv, δℓ, δs, δb_m), optional 24th gyro scale. Φ to third order; updates NHC, speed, ZUPT, ZARU, GNSS position and velocity, map cross-track, junction anchor, magnetometer (start-up), barometric height (optional, PPT). Joseph form; map-free shadow copy; 1 s ring buffer for late fixes; replay at most 10 steps. | §3.3, §3.4 | fixed-size Eigen, no heap in the 10 Hz loop | GoogleTest on analytic cases (Φ series, update Jacobians, no data files); on IO-VNBD: mean NIS per update type ≈ its row count, ANEES ≈ 1 over simulated outages |
| noise adapter runner: input 1×10×30, α = 10^{3 tanh z} scaling R_NHC(lat, up), R_speed, Q_a, Q_ω | §2.1, §3.4 | ONNX Runtime | parity with PyTorch < 1e-5 **(E)** |
| `mapmatch/` (M3): R-tree query within r_t; K=8 candidates; 64 transitions via UBODT; Viterbi + forward; beam ln 10⁴; commit on merge or 10 s lag; restart below 10⁻⁶ emission or with no finite transition; feedback gate π* ≥ 0.95 and no competing parallel road (ambiguity flag; layer/bridge/tunnel tags separate flyovers from the roads beneath). Map-offset Gauss–Markov state with per-road memory. Junction anchors (>45° within 30 m). Re-convergence prior at exits; curvature matching and helical-ramp floor counting Δz = h_f Δψ/2π (USP 3). Tunnel-ahead pre-arming from the tunnel table. | §2.3, §3.3, USP 3 | SQLite read-only connection | share of epochs on the correct edge, break rate, commit latency, Nigeria S-session break rate |
| `integrity/` (M4): pre-checks (r₆₈ ≤ 20 m, ≥ 5 satellites, age ≤ 2 s; on devices also median C/N0 of the four strongest ≥ 25 dB-Hz and HDOP ≤ 4, which IO-VNBD does not carry); innovation gate 13.8; pair test 9.21; velocity CUSUM ν₀=3, h=20; states GNSS_OK/DEGRADED/DR/REACQ/SUSPECT_RF; jamming flag (C/N0 drop on all satellites + AGC); HPL = k_H √λ_max(P_hh) with k_H = 3.72 | §3.4, §1.1 | | share of epochs with error above HPL ≤ 10⁻³ on V truth; mode-switch timing |
| `engine/`: scheduler (IMU rate, 10 Hz, 1 Hz), state publication, events, gyro-less fallback | §3.0, §5.5 | | replay regression per commit |
| `capi/`: `idr.h` C API used by JNI, Objective-C++, ROS 2 and the replay tools | — | | API tests |
| `tools/`: `replay_cli` (IO-VNBD or own-log Parquet → engine → outputs), `ubodt_gen` (A12), `ceres_fits/` (Allan, Wahba truth, tyre radius, NHC noise, GLRT σ_a and σ_ω, slide σ_ν, β, σ_map, L_m) | §4.1, §4.5 | | |

**Rules and parameters per module.** Each is implemented as the dossier states it, and each module's tests cover every line below.

- **M1 start-up (§3.1).**
  - Static start (engine on, GLRT stop): ĝ = f̄/‖f̄‖ over 2 s; b̂_ω = ω̄ over the same 2 s.
  - Moving start: the complementary up-tracker on the unit sphere runs from the first sample. Gain κ_i = (Δt/τ)·exp(−(‖f^c_i‖ − g)²/2σ_g²), τ = 3 s, σ_g = 0.05 g, after removing the vehicle's own acceleration [v̇, v r, 0]ᵀ (in the rolled frame R_x(λ̂) in two-wheeler mode). z̄ is the 60 s mean of ĝ.
  - Axes: the signed lateral axis from turns (from the gyro in two-wheeler mode, with z̄ averaged over straight driving, |r| < 0.02 rad/s); PCA on samples with |r| < 0.02 rad/s and horizontal specific force > 0.05 g; weighted Wahba once speed is known. σ_θ seeds the IEKF mount covariance.
  - States: UNALIGNED (tilt only; NHC and speed off) → COARSE at σ_θ < 10° (NHC with R × 100; speed off) → ALIGNED at σ_θ < 2° (the IEKF refines R_bv).
  - Heading: GNSS course once v > 3 m/s with yaw rate within ±0.02 rad/s. Starting without GNSS: a tilt-compensated magnetometer prior with σ ≥ 20°, accepted only if |‖m̃‖ − B_IGRF| < 10 µT and |I_m − I_IGRF| < 5° (D, B and I from IGRF-14 at the current position). The matched road's direction replaces it as soon as the HMM holds a match. The magnetometer is never fused continuously.
- **M1 slip gating (§2.2, §3.1).**
  - Statistics at 10 Hz: T^tilt > 5° over W = 2 s; CUSUM of NHC NIS with ν₀ = 3, alarm at C > 20; flutter ρ > 3 held for 2 s; more than 5° of accumulated rotation during STATIONARY.
  - Any statistic → SUSPECT: mount updates frozen, R_NHC × 10.
  - Confirmed within 3 s (tilt change > 5° between the windows before and after, a still-rising C, or rotation during a stop) → MOVED: mount covariance reset to σ = 10° roll, 10° pitch, 30° yaw; axis estimators restarted; back to UNALIGNED. The IEKF keeps navigating on GNSS, ZUPT, ZARU and the map.
  - Not confirmed within 3 s → back to ALIGNED.
  - Turn and PCA accumulators freeze while the reverse detector reports reversing.
- **M2 stop detection (§3.2).**
  - σ_a and σ_ω in T_k come from V's engine-on stops (task 1.5). γ starts at 8.60 (W = 10) or 6.81 (W = 100) and is finalised on the ROC against V's stop labels.
  - MOVING → STATIONARY: T_k < γ for 1 s, yaw rate within ±0.02 rad/s, and μ_k + 2σ_k < 0.5 m/s.
  - STATIONARY → MOVING: T_k > 1.5γ for 0.2 s, or at once when μ_k − 2σ_k > 1 m/s.
  - ZUPT every 100 ms with σ_Z ≈ 0.01 m/s. ZARU once per non-overlapping window with σ_R = σ̂_ω/√W.
  - Reverse detector: the sign of f^v_x − g sin θ̂ over the first 0.5 s of motion after each stop. While reversing, the speed update takes a negative sign.
- **Vehicle mode (§2.4).**
  - Car mode by default. The SPRT re-runs after any stop longer than 60 s.
  - In two-wheeler mode the mount-yaw process noise is raised by the kinematic steer angle, about L r/v (a handlebar mount turns with the steering).
  - Slide gate, both modes: side-slip rate ν_k in the heading frame, with the accelerometer moved to the reference point. A slide is flagged when the mean of the last 5 values exceeds 3σ_ν in magnitude. While sliding, α₁ is forced to 10³ and speed updates continue. The flag clears after 1 s with the mean residual below σ_ν.
- **M4 updates (§3.3, §3.4).**
  - NHC: R_NHC = diag(α₁(σ₀ + c|a_y|)², α₂σ_up²), gate ε ≤ χ²₂,₀.₉₉₉ = 13.8.
    - Suspended while the slide or shock flag is set.
    - Inflated while M1 is COARSE or SUSPECT.
    - A rejected NHC update also feeds M1's CUSUM.
  - GNSS position: R = (r₆₈/1.51)² I₂. GNSS velocity: noise fitted against V's 10 Hz GPS, used above 3 m/s. Phone GNSS altitude is not fused.
  - Map cross-track gate χ²₁,₀.₉₉₉ = 10.8. Junction anchor gate χ²₂,₀.₉₉₉ = 13.8.
- **M3 map-matcher (§2.3, §3.3).**
  - Candidates within r_t = max(30 m, 3√λ_max(Pˢ_hh) + w/2) of the shadow filter's position.
  - Restart when the best emission falls below 10⁻⁶ or no transition is finite. Map feedback then stays off until π* ≥ 0.95 for 3 s.
  - b_m decays with distance travelled (correlation length L_m). It resets when the matched edge changes to one that does not continue the current road: b̂_m = 0, P_bm = σ²_map, cross-covariances 0.
  - Projection guard: if a gated-off stretch leaves |z| > w_e/2 + 3√(H⊥PH⊥ᵀ), the mean moves to the corridor edge by Simon's estimate projection (weight P⁻¹). P is left to the next soft update.
  - Junction anchors: heading change > 45° within 30 m, matched with π* ≥ 0.95. The measured point is the corner where the dead-reckoned straight segments cross.
  - σ_map, w_e and L_m are per region. They are fitted on IO-VNBD's open-sky VBOX tracks for the benchmark, and refitted from the app's own open-sky fixes in deployment (`region_map_params` in `user.sqlite`).
- **Deficit handler (§3.4).**
  - DEGRADED: a fix fails a pre-check or the gate. The next accepted fix gets R × 4 for 5 s.
  - DR: no accepted fix for 1.5 s. Fix updates stop at once; only the flag waits.
  - REACQ: the first fix after DR that passes the pre-checks.
    - Fast path: r₆₈ ≤ 5 m and ε ≤ χ²₂,₀.₉₀ = 4.61, applied at once.
    - Otherwise the fix is held for the pair test (≤ 9.21).
  - SUSPECT_RF: velocity-CUSUM alarm. No GNSS updates until 10 s of consistent fixes.
  - Late fixes:
    - A 1 s ring buffer per filter holds (χ̂, P) and the IMU increments per 10 Hz step.
    - A fix is applied at its own epoch, and both filters re-propagate in at most 10 steps.
    - At 200 Hz the IMU is summed into 100 ms pre-integrated blocks.
    - A fix older than 1 s but within the 2 s pre-check is applied at the present, with (v̂Δt_late)² added to each axis of R.
  - HPL: k_H = 3.72 (P_IR = 10⁻³) is the only multiplier validated on IO-VNBD. 4.80 and 5.68 are reported as Gaussian extrapolations.
- **Gyro-less fallback (§5.5).** The sensor list is checked at start-up. Without a gyroscope:
  - speed comes from the accelerometer-only TCN variant plus ZUPT;
  - heading comes from the matched road's direction;
  - turns come from map topology and the gated magnetometer.

  The result is road-level position on mapped roads with no drift guarantee, and the app says so on screen.

C API surface:

```c
idr_engine* idr_create(const idr_config*);              /* rates, noise params per phone model, alert limit */
int  idr_load_models(idr_engine*, const char* speed_onnx, const char* adapter_onnx);
int  idr_load_map(idr_engine*, const char* map_sqlite, const char* user_sqlite);
void idr_push_imu(idr_engine*, const idr_imu*);          /* t_ns, accel, uncalibrated gyro */
void idr_push_mag(idr_engine*, const idr_mag*);  void idr_push_baro(idr_engine*, const idr_baro*);
void idr_push_fix(idr_engine*, const idr_fix*);  void idr_push_gnss_status(idr_engine*, const idr_sat*, int n);
void idr_push_agc(idr_engine*, const idr_agc*, int n);
int  idr_step(idr_engine*, int64_t now_ns);              /* runs the 10 Hz and 1 Hz work that is due */
int  idr_get_state(const idr_engine*, idr_state* out);   /* pos, vel, ellipse, HPL, mode, vehicle mode, edge, path ahead, level, flags */
int  idr_poll_event(idr_engine*, idr_event* out);
int  idr_profile_save(const idr_engine*, char* buf, int n); int idr_profile_load(idr_engine*, const char* json);
void idr_destroy(idr_engine*);
```

### 3.2 ML pipeline (`ml/`, Python 3.11, PyTorch, pandas, NumPy; offline only)

- **Features.** Produced by running the C++ engine (`replay_cli --export-features`), so training sees exactly what the device computes. The speed net takes the vehicle-frame low-passed f and ω through R̂_bv. The adapter takes [fᵛ, ωᵛ, ℓ_fz, ℓ_fy, ℓ_ωx, μ].
- **Stage 1 (speed TCN, 16,418 parameters, §3.2 table).** A unit test asserts the parameter count.
  - Loss: ℒ = ℒ_β-NLL(β = 0.5) + λ_a ℒ_acc + λ_j ℒ_jerk + λ_c ℒ_cons. Each λ starts where its term is ≈10% of the NLL at initialisation and is then tuned on validation.
  - Labels: Fiesta wheel speeds, plus phone-GPS weak labels from the training sessions of the other three cars (2.2.7).
  - Sequences are 50 samples in, 22 outputs out, T = 20 jerk terms.
  - After training: freeze, fit κ̂ on validation.
  - Report speed RMSE against wheel-speed truth; PICP₉₅ must fall in 0.93–0.97; the share of steps beyond ±a_max must be no higher than in the labels.
  - Variants: the accelerometer-only model for gyro-less phones (§5.5) and the two-wheeler head fine-tuned on own logs (§2.4, Phase 4).
- **Stage 2 (noise adapter, 6,949 parameters).**
  - A differentiable IEKF in PyTorch must match the C++ filter with fixed noise to < 1e-6 relative **(E)** before training starts.
  - Loss ℒ_f = Σ_o (1/|o|) Σ_t ‖p̂ − p*‖ / (d_t + 10 m) + λ_N Σ_u (log ε̄_u/m_u)².
  - Windows: 60 s of GNSS, then a 10/30/60/120/180 s outage.
  - Truth: Fiesta VBOX, or accuracy-gated phone GPS on the other cars.
- **Export.**
  - ONNX inputs 1×6×30 and 1×10×30, FP32. Parity checks: PyTorch vs ONNX Runtime (Python) vs the C++ runner, < 1e-5 **(E)**.
  - FP16/INT8 only if speed RMSE stays within 2% **(E)** and PICP₉₅ is unchanged.
  - Models land in `models/<run_id>/` with a model card (data checksums, split, metrics).
- **Evaluation (`make eval`).**
  - Outage protocol §2.2.11. Metrics: CRSE, CAE, AEPS, 2D drift %, along- and cross-track error, NIS and ANEES, HPL exceedance.
  - Baselines: INS only, NHC only, an AI-IMU-style adapter on raw IMU, and WhONet (wheel speeds, marking what OBD would buy). Reported as mean, standard deviation, maximum and minimum over windows.
  - Ablations: no speed updates (§2.1); the map ladder, with and without the cross-track and junction rows (§2.3).
  - `make eval-publish` writes `web/public/eval/*.json` for the dashboard.

### 3.3 Geospatial backend services (`backend/`, A8; transport A9)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/v1/devices` | admin | register a phone; returns its key once |
| GET | `/v1/devices` | admin | list with last seen, mode, HPL |
| POST | `/v1/ingest` | device | batch of states (1 Hz), events, road conditions, trip open/close; idempotent on client IDs; sent every 5 s while online |
| GET | `/v1/live` | admin | GeoJSON FeatureCollection, last state per device (mode, HPL, ellipse, speed, heading, vehicle mode, level, age) |
| GET | `/v1/trips`, `/v1/trips/{id}/track` | admin | trip list; GeoJSON LineString with per-vertex time, mode, HPL |
| GET | `/v1/events` | admin | `bbox`, `from`, `to`, `type` → GeoJSON (R-tree + time index) |
| GET | `/v1/road-conditions` | admin | `bbox`, `kind` → GeoJSON aggregated on a ≈10 m grid with counts |
| GET | `/v1/map-packs`, `/v1/map-packs/{region}/{file}` | device or admin | manifest; downloads with `Range`, `ETag` = sha256 |
| GET | `/maps/{region}/basemap.pmtiles` | public, CORS to the console origin | range-served tiles for the web map |
| WS | `/v1/stream` | admin token in the first message | pushes `state`, `event`, `hpl_alert`, `device_online`, `device_offline` |
| GET | `/v1/health` | public | liveness + DB check |

**Query layer.**
- bbox through R-tree joins.
- Nearest devices: R-tree prefilter, then a haversine sort.
- Time windows on composite indexes.
- Road-condition aggregation by grid snapping in SQL.

**Contracts and security.**
- Contracts: `docs/api/openapi.yaml` (OpenAPI 3.1) and `docs/api/stream.schema.json` (JSON Schema 2020-12). TypeScript types are generated into `packages/contracts`; contract tests run in CI.
- Device keys are stored hashed (with `DEVICE_KEY_PEPPER`).
- HTTPS only through Caddy.
- No personal data beyond device names.

**Optional.** The `osrm` compose profile (A4) snaps raw fixes for console comparisons and evaluation only.

**Test traffic.** `make publish-replay SESSION=…` streams an IO-VNBD session through the real engine into `/v1/ingest`.

### 3.4 Web map application (`web/`, A7)

- **Map.** MapLibre GL JS with `maplibregl.addProtocol('pmtiles', new Protocol().tile)`. Basemap `pmtiles://<backend>/maps/<region>/basemap.pmtiles`; same light and dark styles as the app.
- **Live page.**
  - Device markers coloured by mode: GNSS blue, DR amber, DEGRADED/REACQ grey, SUSPECT_RF red.
  - Uncertainty ellipses built client-side in metres → GeoJSON polygons.
  - HPL rings, with an alert style above the limit.
  - DR track tails (last 2 min); tunnel highlighting from the basemap.
  - Side panel: mode, HPL, fix age, vehicle mode, level.
  - Live updates over WebSocket.
- **Trips.** Trip list and replay: time slider, mode and HPL timeline, GeoJSON export.
- **Events.** Table and map, filtered by type and time range; bbox drawn on the map is sent as `bbox=` to the API.
- **Road conditions.** Clustered pothole and speed-breaker layers with counts.
- **Evaluation.** The IO-VNBD results from `make eval-publish`:
  - drift % against outage length per method;
  - CRSE/CAE/AEPS tables per scenario, plus PICP₉₅ and NIS;
  - session replay of DR against VBOX truth on the England basemap.
- **Map packs.** Versions, sizes and checksums, with download links for sideloading.
- **Controls.** Layer toggles, mode filter, time range, bbox select, light/dark.
- **Auth.** The admin token is kept in memory or sessionStorage; never in the build.

### 3.5 Mobile map application (`mobile/`, Flutter; Android first, iOS when C6 allows)

**Android native layer (Kotlin + NDK):**
- **`NavService`.** Foreground service of type `location` (`FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `ACCESS_FINE_LOCATION`, `POST_NOTIFICATIONS`). It owns the engine through JNI (A3) and keeps running with the screen off. The notification shows mode and HPL. Bluetooth and USB permissions are never declared (§5.2).
- **IMU, magnetometer, barometer.** Read in C++ through NDK `ASensorManager` at 100–200 Hz: accelerometer, uncalibrated gyroscope (bias is estimated by the filter, not changed underneath it), magnetometer (the standard calibrated type; logger mode also records the uncalibrated one), pressure. Event timestamps are on the elapsed-realtime clock. The acquisition chain follows decision 0002.
- **GNSS.**
  - `LocationManager.GPS_PROVIDER` at 1 Hz, never the fused provider.
  - `GnssStatus.Callback`: per-satellite C/N0, elevation, azimuth, constellation; NavIC appears as IRNSS (constellation constant from API 30).
  - `OnNmeaMessageListener`: GSA for DOPs.
  - `GnssMeasurementsEvent.Callback`: raw measurements are logged; AGC comes from `getGnssAutomaticGainControls()` on API 33+, or `GnssMeasurement.getAutomaticGainControlLevelDb()` on API 29–32.
- **Bridge.**
  - Platform channels `idr/nav` (MethodChannel: start, stop, profiles, map packs, logger).
  - `idr/state` (EventChannel at 10 Hz).
  - `idr/events`.
- **Offline caching.**
  - Map packs live under `filesDir/maps/<region>/` and are sha256-verified.
  - The basemap loads as `pmtiles://file://…`; glyphs and sprites are APK assets.
  - `user.sqlite` holds map offsets, profiles, trips, events and the outbox.
  - Telemetry uploads go through WorkManager with a network constraint and retry, so tunnels and basements never lose data.

**Flutter UI (matches `docs/design/app_concepts/`):**
- **Drive.**
  - Map (`maplibre_gl`) with overlays:
    - DR track, and the matched path ahead to the next junction (A16).
    - Uncertainty circle (GNSS) or along/cross ellipse (DR), plus the HPL ring.
    - Rejected-fix markers and tunnel portal callouts; car-park level.
  - Speedometer with a speed-source label (GNSS Doppler or IMU ± σ).
  - Mechanical odometer counting IMU-derived distance; trip and no-GNSS distance.
  - Banners: tunnel ahead (pre-armed), inside tunnel (progress), jamming/spoofing, car-park level; status rows.
- **Satellites.** Sky plot by constellation (NavIC, GPS, Galileo, …); C/N0 bars with the 25 dB-Hz floor; integrity panel (innovation gate, interference C/N0 + AGC, velocity CUSUM).
- **Vehicle.** Car and two-wheeler profiles, lean compensation, mount state, s_v, gyro bias, last learned time.
- **Log.** Trips, interference events and road conditions, with export.
- **Settings.** Map packs (download, verify, delete), device key (scanned once as a QR code from the console, stored with Android Keystore encryption), logger mode, units, light/dark.
- **Gyro-less phones.** The app says that features are reduced (§5.5).

**iOS (Phase 4, when C6 is met).** Core Motion raw accelerometer and gyroscope and Core Location (best accuracy, background location mode) through an Objective-C++ bridge to the same C API. Channel names are the same as on Android; MapLibre iOS comes via `maplibre_gl`.

### 3.6 Integration SDK (`sdk/`) and edge unit (`edge/`)

- **SDK.**
  - Android library module `idr-sdk` (AAR). Contents: `libidr_core.so` for arm64-v8a and armeabi-v7a, both ONNX models, the `NavService`, and the Kotlin API `IdrNavigator` (start/stop, `StateFlow<IdrState>`, `Flow<IdrEvent>`, map-pack install).
  - iOS XCFramework later, under the same C6 condition.
- **Edge (ROS 2 Jazzy, A10).** Packages:
  - `idr_imu_driver` (UART/SocketCAN parser plugin for the IMU named in C5; `sensor_msgs/Imu` at ≈200 Hz, hardware timestamps).
  - `idr_frontend_node` (M2 front end, 20:1 decimation per 0002).
  - `idr_iekf_node` (main + shadow filters; `nav_msgs/Odometry` + HPL diagnostics).
  - `idr_gnss_ublox` (UBX in: NAV-PVT, NAV-SAT, RXM-RAWX; publishes `sensor_msgs/NavSatFix`; out: MGA-INI-POS_LLH and MGA-INI-TIME_UTC assistance; deficit handler).
  - `idr_mapmatch_node`.
  - `idr_replay` (IO-VNBD and own logs → topics, simulated outages).
  - `idr_bringup` (launch files and per-IMU parameters).
  - Verified at 10 Hz replay and on hardware when C5 is met: 200 Hz propagation, 9.7 MMAC/s, CPU load logged.

---

## 4. Repository blueprint

### 4.1 Tree (monorepo `idr26168/`)

```
idr26168/
├── ENGINEERING_GUIDELINES.md      core engineering rules
├── IMPLEMENTATION_PLAN.md         this file
├── README.md                      quick start per tier
├── Makefile                       all pipeline and build targets (§4.3)
├── docker-compose.yml             backend, caddy (prod), tool containers, osrm (optional)
├── .env.example                   compose and backend variables
├── .gitignore  .gitattributes  .editorconfig
├── docs/
│   ├── architecture/              DOSSIER_rev69.md (frozen), PPT_CONTENT_final.md, end_to_end_flow.png,
│   │   └── reference/             RESEARCH_DOSSIER_phase2_usps.md (USP 3/4 only)
│   ├── decisions/                 0001-gap-fills.md (§0.3), 0002-acquisition-chain.md, …  (ADR format)
│   ├── data/                      DATA_DICTIONARY.md, io-vnbd.sha256, MAP_SCHEMA.md, FLEET_SCHEMA.md, OWN_LOG_FORMAT.md
│   ├── api/                       openapi.yaml, stream.schema.json
│   ├── eval/                      PROTOCOL.md, RESULTS.md (generated; budgets vs measured)
│   ├── setup/                     ENVIRONMENT.md (C1–C9 answers), devices/<model>/, TOOLCHAIN.md (pinned versions), CORE.md, ML.md, MAPS.md, BACKEND.md, WEB.md, MOBILE.md, EDGE.md
│   └── design/app_concepts/       concept screens (UI reference)
├── data/                          gitignored except README.md
│   ├── raw/{io-vnbd,osm,igrf,own-logs}/
│   ├── interim/io-vnbd/{V,S}/
│   ├── processed/{sync,truth,labels,calibration}/  splits.json  outages.parquet
│   └── maps/<region>/{map.sqlite,basemap.pmtiles,region.json}
├── models/<run_id>/               speed_tcn.onnx, noise_adapter.onnx, MODEL_CARD.md (committed, ≈93 kB)
├── runs/                          gitignored training and evaluation outputs
├── core/                          C++20, CMake
│   ├── CMakeLists.txt  cmake/  include/idr/idr.h
│   ├── src/{common,lie,geo,frontend,alignment,paive,vehicle_mode,filter,mapmatch,integrity,engine,capi}/
│   ├── tools/{replay_cli,ubodt_gen,ceres_fits}/
│   ├── tests/{unit,replay}/
│   └── third_party/sqlite/        amalgamation with SQLITE_ENABLE_RTREE
├── ml/                            Python (uv)
│   ├── pyproject.toml  uv.lock
│   ├── idr_ml/{io,sync,labels,features,outages,models,losses,filter_torch,train,export,eval,analysis}/
│   ├── configs/  scripts/  tests/
├── maps/                          offline map build
│   ├── pyproject.toml  idr_maps/{regions,fetch,clip,graph,validate,pack}/
│   ├── planetiler/run.sh  styles/{idr-light.json,idr-dark.json,assets/{glyphs,sprites}}
│   └── tests/
├── packages/contracts/            generated TS types + JSON fixtures (from docs/api)
├── backend/                       Node 24 + TypeScript + Fastify
│   ├── src/{server.ts,config.ts,auth/,db/{schema.sql,migrations/},routes/,ws/,services/}
│   ├── test/  Dockerfile  package.json
├── web/                           React + Vite + TypeScript + MapLibre GL JS
│   ├── src/{app,map/{styles,layers},pages/{Live,Trips,Events,Roads,Evaluation,MapPacks},api,state}/
│   ├── public/eval/  vercel.json  .env.example  package.json
├── mobile/                        Flutter
│   ├── lib/{app,features/{drive,satellites,vehicle,log,settings,logger},services,models,widgets}/
│   ├── android/app/src/main/{kotlin/…/{nav,sensors,gnss,bridge,storage,upload,logger},cpp/CMakeLists.txt}
│   ├── ios/Runner/                Objective-C++ bridge, Core Motion, Core Location
│   ├── env/{dev,prod}.json        --dart-define-from-file
│   └── test/  integration_test/
├── sdk/{android/idr-sdk,ios}/
├── edge/                          ROS 2 Jazzy workspace: src/idr_*  Dockerfile
├── docker/                        core-dev.Dockerfile, ml.Dockerfile, maps.Dockerfile, Caddyfile
└── .github/workflows/             ci-core.yml, ci-ml.yml, ci-maps.yml, ci-node.yml, ci-mobile.yml, nightly-replay.yml
```

### 4.2 Configuration blueprints

`.env.example` (repo root, read by compose and the backend):

```dotenv
BACKEND_PORT=8080
PUBLIC_BASE_URL=https://api.example.org
DATABASE_PATH=/data/fleet.sqlite
MAPS_DIR=/data/maps
ADMIN_TOKEN=
DEVICE_KEY_PEPPER=
CORS_ORIGINS=https://<vercel-project>.vercel.app,http://localhost:5173
HPL_ALERT_LIMIT_M=20
STATE_RETENTION_DAYS=30
API_DOMAIN=api.example.org        # Caddy, profile "prod"
ACME_EMAIL=
OSRM_REGION=western-zone          # profile "optional"
```

`web/.env.example`:

```dotenv
VITE_API_BASE_URL=http://localhost:8080
VITE_STREAM_URL=ws://localhost:8080/v1/stream
VITE_BASEMAP_URL=http://localhost:8080/maps/western-zone/basemap.pmtiles
```

`ml/.env.example`: `IDR_DATA_DIR=../data`, `IDR_RUNS_DIR=../runs`, `IDR_DEVICE=cpu`, `IDR_SEED=26168`.
`maps/.env.example`: `OSM_DIR=../data/raw/osm`, `MAPS_OUT=../data/maps`, `PLANETILER_JAVA_OPTS=-Xmx8g`.
`mobile/env/dev.json`: `{"API_BASE_URL": "http://10.0.2.2:8080", "MAP_REGION": "western-zone", "UPLOAD_INTERVAL_S": 5}`.

Dockerfiles:

| File | Base | Contents |
|---|---|---|
| `docker/core-dev.Dockerfile` | ubuntu:24.04 | clang/gcc, CMake, Ninja, Eigen 3.4, GeographicLib, GoogleTest, Ceres 2.2, ONNX Runtime (pinned tarball), Android NDK (for CI cross-builds) |
| `docker/ml.Dockerfile` | python:3.11-slim | uv, PyTorch (CPU; CUDA variant when C4 is met), pandas, NumPy, pyarrow, onnx, onnxruntime |
| `docker/maps.Dockerfile` | eclipse-temurin:21 | osmium-tool, Python + pyosmium, `planetiler.jar` (pinned) |
| `backend/Dockerfile` | node:24-slim, multi-stage | pnpm build, better-sqlite3 native build in the build stage, non-root runtime |
| `edge/Dockerfile` | ros:jazzy | colcon workspace + core |
| `docker/Caddyfile` | caddy:2 | `{$API_DOMAIN}` → `backend:8080`, automatic TLS |

`docker-compose.yml` services:
- `backend` (volume `fleet-data:/data`, mounts `data/maps` read-only)
- `caddy` (profile `prod`)
- `maps`, `ml`, `core-dev` (profile `tools`, for `make` targets)
- `osrm` (profile `optional`)

### 4.3 Make targets

```
make setup                       build the tool containers, check toolchain pins
make fetch-data                  IO-VNBD via LFS + IGRF-14; prints the §1 fallback commands on failure
make data sync truth labels calib fold-test splits outages   §2.2.1–2.2.11, in order
make ingest-own-logs             own-log sessions → canonical Parquet (§2.6)
make regions fetch-osm           session bounding boxes → Geofabrik list → downloads
make maps REGION=<r>             clip → graph → UBODT → validate → map.sqlite
make tiles REGION=<r>            Planetiler → basemap.pmtiles
make pack REGION=<r>             region.json with sizes and checksums
make core core-test              build the core, GoogleTest
make replay SESSION=<id>         engine over one session, with plots
make features train-stage1 train-stage2 export eval eval-publish
make backend-dev web-dev         local servers
make publish-replay SESSION=<id> IO-VNBD replay → backend ingest
make android-debug               APK for the test phone
make edge-build edge-replay      ROS 2 workspace, replay launch
make secrets                     ADMIN_TOKEN, DEVICE_KEY_PEPPER, device keys
```

### 4.4 Documentation standards

- **API.** `docs/api/openapi.yaml` (OpenAPI 3.1) is the source of truth for REST; `stream.schema.json` for WebSocket messages. Code and types are generated from them, and CI fails on drift.
- **Data.**
  - `DATA_DICTIONARY.md` lists, for every column of every table: name, type, unit, frame, source column and transform. It covers IO-VNBD V/S raw and canonical files, processed tables, `map.sqlite`, `user.sqlite`, `fleet.sqlite`, and own logs.
  - `io-vnbd.sha256` pins the raw inputs.
- **Decisions.** Short ADRs in `docs/decisions/` (context, decision, consequences). 0001 is §0.3. A new ADR needs a team member's approval in the PR.
- **Setup.** One file per tier with copy-paste commands for Windows (PowerShell + WSL2) and Linux; `TOOLCHAIN.md` lists exact versions, pinned in Phase 0.
- **Results.** `docs/eval/RESULTS.md` is generated by `make eval` from a run ID and shows dossier budgets next to measured values. No hand-edited numbers.
- **Code documentation.**
  - C++ public headers: Doxygen.
  - Python: docstrings + pytest.
  - TypeScript: TSDoc + vitest.
  - Dart: dartdoc + flutter_test.
  - Each module cites its dossier section in its header comment.

---

## 5. Phased execution roadmap

The long pole is Phase 2A (core and models). Phases 2B and 3 start as soon as Phase 1 produces map packs, and they are tested with IO-VNBD replays through the core. The Phase 4 UI starts on replay before trained models exist. Owner: **A** = me, **T** = your team.

### Phase 0 — requirements validation, dataset handoff, environments

| ID | Task | Owner | Output |
|---|---|---|---|
| 0.1 | Scaffold the monorepo per §4.1. Commit the dossier rev 69, PPT content, concept screens, ADR 0001. | A | repo skeleton |
| 0.2 | Pin toolchains; build the tool containers; CI skeleton per tier | A | `TOOLCHAIN.md`, green CI |
| 0.3 | Requirements matrix: brief targets (dossier claims table) → acceptance checks (Phase 5 table) → tasks | A | `docs/eval/PROTOCOL.md` |
| 0.4 | Fetch IO-VNBD (LFS) and IGRF-14; record checksums | A | `data/raw/*`, `io-vnbd.sha256` |
| 0.5 | Copy this folder into the root of the existing GitHub repo and push; open the repo folder itself in the code session; answer C1–C9 and add the device files, both in `docs/setup/ENVIRONMENT.md` | T | answers and `docs/setup/devices/<model>/` |
| 0.6 | Run the §1 fallbacks if 0.4 failed | T | raw files delivered |
| 0.7 | Toolchain smoke tests: core library builds for Linux and Android NDK; Flutter shell installs on the test phone and calls a stub C API over JNI; ROS 2 container builds | A, T (install on phone) | screenshots and logs |

**Gate G0:**
- Raw data present with matching checksums.
- All containers build.
- The Flutter shell on the phone reaches the native core.
- C1–C9 answered or defaulted.

### Phase 1 — preprocessing, spatial indexing, database population

| ID | Task | Owner | Output |
|---|---|---|---|
| 1.1 | Inventory and canonicalise IO-VNBD; data dictionary v1 checked against `README_1.pdf` | A | interim Parquet, `DATA_DICTIONARY.md` |
| 1.2 | Timestamp repair, GNSS cleaning, session registry incl. scenario labels and the GPS-outages file | A | manifest |
| 1.3 | S/V synchronisation with QA report | A | `processed/sync` |
| 1.4 | Truth trajectories and labels (wheel speed, stops, weak GPS labels) | A | `processed/truth`, `processed/labels` |
| 1.5 | Calibration fits with the Ceres tools (Allan per phone, Wahba truth, NHC noise, GNSS velocity noise, a_max, j_max, σ_c, GLRT σ_a and σ_ω from engine-on stops, slide-gate σ_ν) | A | `processed/calibration` |
| 1.6 | Fold test → ADR 0002 acquisition chain | A | ADR |
| 1.7 | Frozen splits and outage index | A | `splits.json`, `outages.parquet` |
| 1.8 | Front end in C++ and its Python mirror, with parity tests (needed by 1.5 and Phase 2) | A | `core/src/frontend`, `ml/idr_ml/features` |
| 1.9 | Regions from session boxes; fetch OSM; build `map.sqlite` (graph, R-tree, UBODT, junctions, tunnels) for the IO-VNBD regions and the India demo region; validation reports | A | `data/maps/<region>/` |
| 1.10 | PMTiles basemaps, light/dark styles, glyphs, sprites; map packs with `region.json` | A | packs |
| 1.11 | `fleet.sqlite` schema and migrations; `user.sqlite` schema | A | `backend/src/db`, `mobile/…/storage` |

**Gate G1:**
- Data dictionary verified against `README_1.pdf`.
- Sync residuals within the QA bounds recorded in the report.
- Fitted tyre radii physically plausible per session.
- Every map pack passes the connectivity and oneway checks, with its UBODT size recorded. The India pack's tunnel table contains the Mumbai Coastal Road tunnels.
- Front-end parity tests pass.

### Phase 2 — backend services and geospatial API delivery

**2A — navigation core and models (the dossier's engine):**

| ID | Task | Owner | Output |
|---|---|---|---|
Order follows the dependencies: M1's static start needs the stop detector, Stage 1 needs M1's R̂_bv, and M1's swivel CUSUM needs the IEKF's NHC innovations.

| ID | Task | Owner | Output |
|---|---|---|---|
| 2.1 | `lie/`, `geo/` (incl. IGRF-14 evaluator), `common/`, C API skeleton, `replay_cli` | A | unit tests green |
| 2.2 | GLRT stop detector (σ_a and σ_ω from 1.5; γ from the ROC on V stop labels), yaw-rate gate, ZUPT, ZARU, reverse detector. The speed gates (μ ± 2σ) are wired in 2.4. | A | stop recall, false stops per km |
| 2.3 | M1: start-up sequence, up-tracker, turn/PCA/Wahba axes, magnetometer prior with IGRF gates, slip states with the tilt, flutter and stop-rotation statistics, vehicle profiles. The NHC-NIS CUSUM is wired in 2.6. | A | mount-error report against Wahba truth |
| 2.4 | Feature export from replay; Stage 1 training; κ̂; ONNX export with parity; stop-detector speed gates | A | `models/<run>/speed_tcn.onnx`, metrics |
| 2.5 | IEKF (23 states) and shadow; all updates of §3.4; replay buffer; re-anchoring | A | NIS and ANEES reports |
| 2.6 | Wire M1's NHC-NIS CUSUM (ν₀ = 3, h = 20) and the MOVED mount-covariance reset into the IEKF; slip-injection runs (15°/45°/90° and yaw-only) | A | slip-injection report |
| 2.7 | Differentiable PyTorch IEKF with parity; Stage 2 training; ONNX export | A | `noise_adapter.onnx`, NIS per roughness decile |
| 2.8 | M3: HMM, map cross-track, junction anchors, projection guard, map-offset state and memory, re-convergence prior, curvature matching, helical-ramp floor count, tunnel pre-arming; fits of β, σ_map, w_e, L_m | A | matching report |
| 2.9 | Vehicle mode (SPRT with re-runs after stops > 60 s, lean, slide gate, lever arm) | A | SPRT and slide reports |
| 2.10 | Deficit handler (state table and late-fix rules), interference monitor, HPL | A | integrity report |
| 2.11 | Evaluation harness with all baselines and ablations; first `RESULTS.md` | A | measured tables |

**2B — fleet backend and geospatial API:**

| ID | Task | Owner | Output |
|---|---|---|---|
| 2.12 | Fastify service per §3.3: auth, ingest, live, trips, events, road conditions, map packs, PMTiles range serving, WebSocket stream, health; OpenAPI + contract tests | A | `backend/`, `docs/api/` |
| 2.13 | `publish-replay`: IO-VNBD sessions through the engine into the API | A | test traffic from real data |
| 2.14 | Load test: 50 devices at 1 Hz for 1 h from replays | A | report |
| 2.15 | Provision host and DNS; set secrets; `docker compose --profile prod up -d` | T (commands from A) | live API URL |

**Gate G2:**
- Every §3 check in the Phase 5 table is reported on IO-VNBD with run IDs.
- Model parity < 1e-5 **(E)**; model sizes match 16,418 + 6,949 parameters.
- Contract tests pass; the load test finishes without errors at p95 < 200 ms **(E)** for bbox queries.
- The deployed API answers `/v1/health` over HTTPS.

### Phase 3 — web client and interactive map layers

| ID | Task | Owner | Output |
|---|---|---|---|
| 3.1 | Vite + React + TypeScript app, MapLibre GL JS with the pmtiles protocol, shared styles, generated API client | A | `web/` |
| 3.2 | Live page: markers by mode, ellipses, HPL rings and alerts, DR tails, tunnel highlight, side panel, WebSocket | A | |
| 3.3 | Trips (replay, timelines), Events (filters, bbox), Road conditions (clusters), Map packs | A | |
| 3.4 | Evaluation dashboard from `make eval-publish` | A | |
| 3.5 | Playwright end-to-end tests against the replay-fed backend | A | CI job |
| 3.6 | Re-link the Vercel project to this repo (Root Directory `web/`); set `VITE_*`; promote production | T (steps from A) | production URL serves the console |

**Gate G3:**
- With an IO-VNBD replay running, the production console shows a moving vehicle, mode changes at simulated outages, HPL rings and events.
- Playwright tests pass.

### Phase 4 — mobile client, map interactions, offline caching

| ID | Task | Owner | Output |
|---|---|---|---|
| 4.1 | Android native layer: `NavService`, NDK sensors, GNSS (status, NMEA, measurements, AGC), barometer, JNI bridge | A | |
| 4.2 | Flutter tabs per the concept screens; speedometer, odometer, banners, stat rows | A | |
| 4.3 | Map view with the local PMTiles basemap and live overlays; map-pack download and verification; sideload path | A | |
| 4.4 | Outbox uploader, device-key QR provisioning, logger mode, gyro-less notice | A | |
| 4.5 | Debug APK; install; permission and background checks (screen off 30 min, airplane mode) | A builds, T installs | |
| 4.6 | Field sessions (protocols below); hand over logs (`adb pull /sdcard/Android/data/<pkg>/files/logs`) | T | `data/raw/own-logs/` |
| 4.7 | Own-log ingest; Allan per test phone; two-wheeler speed head fine-tune; 200 Hz clean-chain fine-tune (§3.2 step 5) | A | `models/<run>/` |
| 4.8 | iOS bridge and build (when C6 is met) | A writes, T builds on a Mac | |
| 4.9 | Android SDK AAR with sample integration | A | `sdk/android` |

Field protocols (task 4.6; run counts and durations are **(E)**):
- **P1 car park.** 10 runs of about 50 m within one minute of losing GNSS at the entry ramp, each with one 180° turn. Markers at the ramp and at the parked bay. The bay position is surveyed from the floor plan by tape measure from a reference point. Include at least one floor change on phones with a barometer.
- **P2 two-wheeler.** Chassis-fixed mount; three 30-minute urban loops with GNSS on (outages are cut in post with the IO-VNBD protocol); include roundabouts, U-turns and crawling traffic.
- **P3 auto-rickshaw.** Two 30-minute loops (roll slope, car-mode SPRT).
- **P4 tunnel or underpass.** Real passes with portal markers, where accessible (e.g. the Mumbai Coastal Road tunnels).
- **P5 static.** 20 minutes engine-on and stationary per phone, for Allan deviation.

**Gate G4:**
- The app runs 30 minutes with the screen off without being killed.
- In airplane mode, dead reckoning continues and the basemap renders from the local pack.
- Queued uploads arrive after reconnecting.
- Every field session passes the logger schema check.

### Phase 5 — end-to-end integration, performance validation, handover

| ID | Task | Owner | Output |
|---|---|---|---|
| 5.1 | End to end: phone → API → console on a real drive, and IO-VNBD replays | A, T | recorded demo |
| 5.2 | On-device performance: per-cycle latency p50 and p99 with one thread pinned to a little core over 10⁴ runs, then a 30-minute sustained 10 Hz run logging CPU frequency and temperature; mode-switch timing from run logs | A scripts, T runs | performance report |
| 5.3 | Drift validation: IO-VNBD outage tables with baselines; P1 car-park error; P2 two-wheeler outages; P4 tunnel passes | A | `RESULTS.md` |
| 5.4 | Integrity validation: NIS per update type, ANEES, HPL exceedance at 10⁻³ | A | report |
| 5.5 | Edge: ROS 2 packages; replay verification; hardware run when C5 is met | A, T | report |
| 5.6 | Handover: setup per tier, runbooks (map packs, training, evaluation, deploy), OpenAPI, data dictionary, results with budgets beside measured values, known limits | A | `docs/` |

**Gate G5:** the acceptance table below is filled with measured values and run IDs, and the demo script has been rehearsed.

Acceptance checks (all from the dossier; "report" means the dossier sets no pass mark):

| Check | Dossier | Pass mark |
|---|---|---|
| Tunnel-class drift, 1 km at 60 km/h | claims, §5.4 | < 10% of distance (budget 43.5 m RSS, 53.0 m worst) |
| Car-park drift on IO-VNBD low-speed stretches | claims | report against the 5 m budget (IO-VNBD has no car park) |
| Car-park drift (own logs P1) | claims, §5.4 | < 5 m over 50 m in < 1 min (budget 3.3 m, 4.4 m worst) |
| CRSE, CAE, AEPS, 2D drift %, along/cross-track, 10–180 s | §7.1, §5.4 | report, with all four baselines |
| No-speed ablation: 2D drift % on 10–180 s outages | §2.1 | report beside the full system |
| Map ablation ladder: cross-track error against time over 10–180 s outages | claims, §2.3 | report; 1σ budget 1.4–6.3 m by road case, ≤ 1.75 m only where the lane is known and GNSS calibrated b_m |
| Along-track error before and after matched junctions | §2.3 | report |
| Error at the first accepted fix and 5 s later, on real outages from the GPS-outages file | §2.3 | report |
| Speed RMSE; PICP₉₅ | §2.1 | report; 0.93–0.97 |
| Share of steps beyond ±a_max | §2.1 | ≤ labels' share |
| Mean NHC NIS per roughness decile | §2.1 | ≈ 2 |
| Engine harmonics | claims, §3.2 | fold test with V's rpm decides the acquisition chain (ADR 0002); at 200 Hz the cascade attenuates 15–40 Hz by 46.5–85 dB |
| Mount yaw error against Wahba truth | §3.1 | < 2° within 60 s or 3 turns |
| Slip injection 15°/45°/90° | §3.1 | report delay, time back below 3°, false alarms per hour |
| Yaw-only (swivel) injections | §2.2 | report delay; false alarms per hour on the bump and pothole files |
| Stop recall; false stops per km at 0.5–3 m/s | §3.2 | report |
| Correct-edge share, break rate, commit latency under simulated 10–180 s outages; break rate on the Nigeria S-sessions | §3.3 | report |
| SPRT on IO-VNBD car sessions | §2.4 | none ends in two-wheeler mode |
| Car roll slope on the roundabout and sharp-turn files | §2.4, §3.1 | outward, 3–6 deg/g; AndroSensor's Gravity columns reported as the baseline to beat |
| Two-wheeler mode on runs built from Fiesta trajectories (§2.4 transform) | §2.4 | report tilt error with and without the mode; NHC NIS |
| Slide detection on the skid and drift files, truth ν^V = a^V_y/(1 + gK_φ) − r^V v^V | §2.4 | report delay, false alarms per hour |
| Mean NIS per update type; ANEES | §3.4 | ≈ row count; ≈ 1 |
| Share of epochs with error above HPL | §3.4 | ≤ 10⁻³ |
| Per-cycle latency on a Cortex-A55 core | claims, §5.1 | p99 **(E)** < 15 ms; 30 min sustained without throttling |
| Mode switch | claims, §3.4 | GNSS → DR 0 ms (no model swap; DR flag after 1.5 s); DR → GNSS fused update < 100 ms after fix arrival |
| NavIC/GNSS re-lock | claims | restated by the dossier; receiver log vs filter log, software owns only the fix-to-update path |
| Model size | claims | < 1.5 M parameters, < 15 MB (design: 23,367, ≈93 kB) |
| No OBD or CAN | claims, §5.2 | proof 1: exported inputs are 1×6×30 and 1×10×30 built from phone streams only; proof 2: pipeline scored against phone GPS on the S-only test sessions; proof 3: no OBD/CAN client, no Bluetooth or USB permission |
| Edge propagation | §4.4, §5.3 | 200 Hz sustained on Pi 5 or Jetson (when C5 is met) |
