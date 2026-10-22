# IDR 26168 — Evaluation Protocol & Requirements Matrix

SIH 2026 · Problem Statement 26168 (ISRO) · AI-ML based Intelligent Dead Reckoning system for seamless navigation.

---

## 1. Overview and Core Rules

1. **Dataset Boundary:** Only the IO-VNBD dataset (`github.com/onyekpeu/IO-VNBD`), OpenStreetMap extracts (Geofabrik), IGRF-14 coefficients, and validated own-device field logs are permitted. No synthetic stand-ins.
2. **Deterministic Evaluation:** All benchmark metrics are produced by reproducible scripts with seed `26168`, tagged with a unique run ID, and recorded in `docs/eval/RESULTS.md`.
3. **No CAN/OBD at Runtime:** Verification must prove that runtime models receive phone IMU, magnetometer, GNSS fixes, and offline OSM map only. CAN/wheel-speed data is used strictly for offline supervised training, ground truth validation, and WhONet comparison.

---

## 2. Requirements Traceability Matrix

| Brief Target | Dossier Requirement | Pass Mark | Evaluation Metric | Testing Protocol & Tool | Plan Task |
|---|---|---|---|---|---|
| **Tunnel Drift** | < 100 m over 1 km @ 60 km/h (10% distance) | < 10% drift (Design budget: 43.5 m RSS, 53.0 m worst case) | 2D End-Point Error (EPE), 2D drift % | Simulated 60 s outages slid along IO-VNBD trajectories; `core/tools/replay_cli` + `ml/idr_ml/eval` | 2.11, 5.3 |
| **Car-Park Drift** | < 5 m over 50 m in < 1 min | < 5 m over 50 m in < 60 s (Budget: 3.3 m RSS, 4.4 m worst case) | 2D EPE, along-track & cross-track error | IO-VNBD low-speed stretches + Field Protocol P1 (10 surveyed car-park runs); `replay_cli` | 4.6, 5.3 |
| **Mobile Runtime Latency** | 10 Hz sustained, < 15 ms per cycle on Cortex-A55 | p99 < 15 ms; 30 min sustained without thermal throttling | Per-cycle execution time (p50, p95, p99) | Standalone benchmark on Cortex-A55 core, 10,000 continuous cycles | 5.2 |
| **Edge Propagation Rate** | ~ 200 Hz propagation | 200 Hz sustained | Mean propagation frequency, CPU load | ROS 2 Jazzy node (`idr_iekf_node`) on Raspberry Pi 5 / Jetson or Linux container | 5.5 |
| **Mode Switch Latency** | < 100 ms in both directions | GNSS → DR: 0 ms (seamless transition; DR flag raised at 1.5 s). DR → GNSS: < 100 ms (fix to fused update) | Timestamp delta: `t_fused - t_fix_arrival` | Replay log inspection on real outage exits | 2.10, 5.2 |
| **NavIC / GNSS Re-lock** | < 50 ms | Restated: Receiver hardware sets acquisition time (e.g. 1 s hot start); software guarantees < 100 ms fix-to-filter update | Software latency < 100 ms | Timestamp logging in `NavService` | 2.10, 5.2 |
| **Cross-Track Bound** | ≤ 1.75 m (half of 3.5 m lane) | Restated: 1.4 m on 1-lane road or keep-left with calibrated $b_m$; 1.4–6.3 m road-level otherwise | Lateral distance from road centreline | Map ablation study over 10–180 s simulated outages | 2.8, 5.3 |
| **No OBD / CAN at Runtime** | Zero vehicle bus dependency | Zero CAN/OBD runtime connection | Audit proof: 1×6×30 and 1×10×30 input signatures; permissions check (no BT, no USB) | Code inspection & APK manifest verification | 2.4, 5.2 |
| **Engine Harmonics** | Reject 15–40 Hz vibrations | 46.5–85 dB attenuation of 15–40 Hz at 200 Hz sampling; 4 Hz 4th-order Butterworth cascade | Frequency response & FFT analysis | Fold test against Fiesta engine RPM channel | 1.6, 5.2 |
| **Model Size** | < 1.5 M parameters, < 15 MB | Total 23,367 parameters (Speed TCN: 16,418, Noise Adapter: 6,949), ≈93 kB FP32 | Parameter count & ONNX file size | Automated parameter count test in PyTorch and C++ runner | 2.4, 2.7 |

---

## 3. Algorithm & Component Acceptance Checks

### 3.1 M1 Alignment & Slip Gating (§2.2, §3.1)
- **Mount Convergence:** Yaw error against Wahba CAN truth < 2° within 60 s or 3 turns.
- **Slip Injection Test:** Inject artificial 15°, 45°, 90° slips and yaw-only slips:
  - Detection delay < 2 s.
  - Recovery time to error < 3°.
  - False alarm rate < 1 per hour on rough road/pothole files.

### 3.2 M2 P-AIVE & Stop Detection (§2.1, §3.2)
- **Speed TCN Parity:** C++ ONNX Runtime inference vs PyTorch output < 1e-5 relative difference.
- **Speed Uncertainty:** PICP₉₅ (Prediction Interval Coverage Probability at 95%) must fall within 0.93–0.97 on validation sessions.
- **Kinematic Bounding:** Share of acceleration steps exceeding $\pm a_{\max}$ must not exceed ground-truth share.
- **Stop Detection (GLRT):** 100% recall on true stops; false stop rate < 0.1 per km between 0.5 and 3.0 m/s.

### 3.3 M3 Map Matching (§2.3, §3.3)
- **Topological Correctness:** Correct-edge match rate > 95% on mapped corridors.
- **Break Rate:** Fraction of epochs with HMM state resets < 1% during continuous driving.
- **Commit Latency:** Maximum lag before committing trajectory < 10 s.
- **Junction Anchor Accuracy:** Along-track error reduction at 45°+ junctions with $\pi^* \ge 0.95$.

### 3.4 M4 Fusion Filter & Integrity (§2.1, §3.4)
- **Normalized Innovation Squared (NIS):** Mean NIS for each sensor update type approximately equals update dimension (NHC: 2, Speed: 1, GNSS Pos: 2, GNSS Vel: 2).
- **ANEES (Average Normalized Estimation Error Squared):** ANEES ≈ 1 across simulated outages.
- **Horizontal Protection Level (HPL):** Empirical integrity risk (position error exceeding HPL) $\le 10^{-3}$ using $k_H = 3.72$.

### 3.5 Vehicle Mode Classification (§2.4)
- **SPRT Discrimination:** 100% of car sessions in IO-VNBD classified as Car mode; zero false two-wheeler classifications.
- **Roll Slope:** Car outward roll slope verified within 3–6 deg/g.

---

## 4. Benchmark Baselines for Comparative Reporting

Every evaluation report compares the complete IDR engine against four baselines over identical outage windows (10 s, 30 s, 60 s, 120 s, 180 s):
1. **INS-only:** Raw uncalibrated IMU integration (pure dead reckoning without constraints).
2. **NHC-only:** IEKF with Non-Holonomic Constraints only (no learned speed).
3. **AI-IMU Adapter:** AI-IMU style covariance adaptation on raw IMU without P-AIVE speed network.
4. **WhONet:** Wheel-speed aided navigation (representing physical OBD-II bound).
