# IDR 26168 — Pinned Toolchain Specifications

This document defines the exact pinned versions of compilers, runtimes, package managers, and dependencies used across all tiers of the IDR 26168 monorepo.

---

## 1. Host and Platform Specifications

| Component | Pinned Version / Requirement | Notes |
|---|---|---|
| **Host OS** | Windows 11 (64-bit) / Ubuntu 24.04 LTS (WSL2 / Docker) | Native Windows for mobile adb & desktop; Docker/WSL2 for portable containers |
| **C++ Compiler** | GCC 15.2.0 (MSYS2 UCRT64) / Clang 18 (Ubuntu 24.04) | C++20 compliant (`-std=c++20`), Eigen3 fixed-size alignment |
| **CMake** | 3.28+ (Tested: 4.4.4) | Build system for `core/`, NDK cross-compilation, and ROS 2 ament_cmake |
| **Ninja** | 1.12+ (Tested: 1.13.2) | Fast parallel build generator |
| **Python** | 3.11.x (Offline ML & Data Engineering) | Managed via `uv` or system Python 3.11/3.14 |
| **Node.js** | Node.js 24 LTS (Tested: v26.8.1) | Runtime for Fastify backend and Vite build |
| **Package Manager** | `pnpm` 10+ / 12+ (Tested: 12.14.0) | Strict workspace monorepo management |
| **Git & LFS** | Git 2.45+ (Tested: 2.51.0), Git-LFS 3.5+ (Tested: 3.7.0) | Tracks datasets and models |

---

## 2. Core Navigation Engine (`core/`)

| Library / Dependency | Pinned Version | Scope |
|---|---|---|
| **Eigen** | 3.4.0 | Header-only linear algebra, matrix operations, Lie algebra |
| **GeographicLib** | 2.3+ | LocalCartesian tangent planes, WGS-84 geodesic distance and azimuth |
| **SQLite3 Amalgamation** | 3.46+ | Embedded database with `-DSQLITE_ENABLE_RTREE=1` |
| **ONNX Runtime** | 1.18.0 / 1.19.0 (C++ API) | Neural network inference for Speed TCN & Noise Adapter |
| **GoogleTest** | 1.14.0+ | C++ unit testing and parity benchmarks |
| **Ceres Solver** | 2.2.0 (Offline tools only) | Wahba ground-truth orientation, Allan variance fitting, sensor calibration |

---

## 3. Machine Learning & Training (`ml/`)

| Dependency | Version / Specification |
|---|---|
| **Python Package Manager** | `uv` 0.13.4+ |
| **PyTorch** | 2.3.0+ / 2.4.0+ (CPU default, CUDA optional per C4) |
| **ONNX** | 1.16.0+ |
| **onnxruntime** | 1.18.0+ |
| **NumPy** | 1.26.4 / 2.x |
| **Pandas** | 2.2.0+ / 3.0+ |
| **PyArrow** | 16.0.0+ (Parquet storage) |
| **SciPy** | 1.13.0+ (Butterworth filters, cross-correlation) |
| **pytest** | 8.0.0+ |

---

## 4. Map Processing Pipeline (`maps/`)

| Tool / Dependency | Version | Purpose |
|---|---|---|
| **Osmium Tool** | 1.16.0+ | PBF extraction, bounding box clipping |
| **PyOsmium** | 3.7.0+ | Fast OSM parsing in Python |
| **Planetiler** | 0.8.0+ | Vector tile generation into single `.pmtiles` |
| **Java JRE** | OpenJDK 21 (Eclipse Temurin) | Planetiler runtime (`-Xmx8g`) |

---

## 5. Fleet Backend & Geospatial API (`backend/`)

| Dependency | Version |
|---|---|
| **Fastify** | 5.x |
| **better-sqlite3** | 11.x (with compiled R*Tree) |
| **ws / @fastify/websocket** | 11.x |
| **zod** | 3.23+ (Schema validation) |
| **vitest** | 2.x (Unit & API integration testing) |

---

## 6. Web Application (`web/`)

| Dependency | Version |
|---|---|
| **React** | 19.x |
| **Vite** | 6.x |
| **MapLibre GL JS** | 5.x |
| **@protomaps/pmtiles** | 3.x |
| **TailwindCSS** | 4.x |

---

## 7. Mobile Application (`mobile/`)

| Framework / Tool | Pinned Version | Notes |
|---|---|---|
| **Flutter SDK** | 3.24+ / 3.27+ | Cross-platform UI |
| **Android NDK** | r26d / r27b | C++ compilation for `libidr_core.so` |
| **Android SDK** | API Level 34 (compileSdk 34, minSdk 29) | Android 10+ target; NavIC / AGC support |
| **maplibre_gl** | 0.27.x (Bundles MapLibre Android 13.5) | Vector map renderer |

---

## 8. Edge Robotics (`edge/`)

| System / Middleware | Pinned Version | Notes |
|---|---|---|
| **ROS 2** | Jazzy Jalisco (LTS) | Ubuntu 24.04 noble base image |
| **Colcon** | 0.16.0+ | ROS 2 build system |
| **ament_cmake** | Jazzy standard | C++ package orchestration |
