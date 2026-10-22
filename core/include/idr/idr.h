/**
 * @file idr.h
 * @brief Public C API for IDR 26168 Intelligent Dead Reckoning Navigation Engine.
 * 
 * SIH 2026 · PS 26168 · ISRO
 * Single C-linkage API consumed by:
 * - Android NDK / JNI (mobile/android)
 * - iOS Objective-C++ bridge (mobile/ios)
 * - ROS 2 Jazzy node (edge/)
 * - Python / Replay CLI tools (core/tools)
 */

#ifndef IDR_H
#define IDR_H

#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

#if defined(IDR_STATIC)
  #define IDR_API
#elif defined(_WIN32) || defined(__CYGWIN__)
  #ifdef IDR_EXPORTS
    #define IDR_API __declspec(dllexport)
  #else
    #define IDR_API __declspec(dllimport)
  #endif
#else
  #define IDR_API __attribute__((visibility("default")))
#endif

/* System navigation modes (§3.4) */
typedef enum {
  IDR_MODE_GNSS_OK    = 0,
  IDR_MODE_DEGRADED   = 1,
  IDR_MODE_DR         = 2,
  IDR_MODE_REACQ      = 3,
  IDR_MODE_SUSPECT_RF = 4
} idr_nav_mode;

/* Vehicle classification modes (§2.4) */
typedef enum {
  IDR_VEHICLE_CAR         = 0,
  IDR_VEHICLE_TWO_WHEELER = 1
} idr_vehicle_mode;

/* Mount alignment states (§3.1) */
typedef enum {
  IDR_ALIGN_UNALIGNED = 0,
  IDR_ALIGN_COARSE    = 1,
  IDR_ALIGN_ALIGNED   = 2,
  IDR_ALIGN_SUSPECT   = 3,
  IDR_ALIGN_MOVED     = 4
} idr_align_state;

/* Benchmark and ablation baseline modes (§4) */
typedef enum {
  IDR_BASELINE_FULL        = 0, /* Full IDR (TCN speed + Noise Adapter + IEKF + Map) */
  IDR_BASELINE_INS_ONLY    = 1, /* Pure INS (no velocity updates or constraints) */
  IDR_BASELINE_NHC_ONLY    = 2, /* NHC only (v_y=0, v_z=0, no learned speed) */
  IDR_BASELINE_NO_ADAPTER  = 3, /* TCN speed with fixed alpha=1.0 (no noise adapter) */
  IDR_BASELINE_NO_MAP      = 4, /* Full DR without map-matching feedback */
  IDR_BASELINE_WHONET      = 5  /* Wheel-speed aided navigation (OBD reference bound) */
} idr_baseline_mode;

/* Configuration supplied at engine creation */
typedef struct {
  double imu_rate_hz;              /* 10.0 to 200.0 */
  double alert_limit_m;            /* Default 20.0 m */
  int has_gyroscope;               /* 1 = yes, 0 = gyro-less fallback (§5.5) */
  int has_barometer;               /* 1 = yes, 0 = no baro */
  double sigma_accel_noise;        /* Accelerometer VRW (m/s/sqrt(h)) */
  double sigma_gyro_noise;         /* Gyroscope ARW (deg/sqrt(h)) */
  const char* phone_model;         /* For Allan param lookup */
  int baseline_mode;               /* idr_baseline_mode */
} idr_config;

/* High-rate IMU input struct */
typedef struct {
  int64_t t_ns;                    /* Monotonic elapsed-realtime timestamp in ns */
  double ax, ay, az;               /* Specific force (m/s^2) in phone body frame */
  double gx, gy, gz;               /* Uncalibrated angular rate (rad/s) in phone frame */
} idr_imu;

/* Magnetometer input */
typedef struct {
  int64_t t_ns;
  double mx, my, mz;               /* Calibrated magnetic flux (microTesla) */
} idr_mag;

/* Barometer input */
typedef struct {
  int64_t t_ns;
  double pressure_hpa;             /* Atmospheric pressure in hPa */
} idr_baro;

/* GNSS Fix input */
typedef struct {
  int64_t t_ns;
  int64_t utc_ms;
  double lat_deg;                  /* WGS-84 latitude */
  double lon_deg;                  /* WGS-84 longitude */
  double alt_m;                    /* WGS-84 altitude (m) */
  double speed_mps;                /* Ground speed (m/s) */
  double bearing_deg;              /* Course over ground (deg) */
  double r68_m;                    /* 68% horizontal accuracy radius (m) */
  int num_sats;
  int valid;
} idr_fix;

/* Single satellite status */
typedef struct {
  int svid;
  int constellation;               /* 1=GPS, 3=GLONASS, 6=Galileo, 7=NavIC/IRNSS */
  double cn0_dbhz;
  double elevation_deg;
  double azimuth_deg;
  int used_in_fix;
} idr_sat;

/* Automatic Gain Control reading */
typedef struct {
  int constellation;
  double carrier_hz;
  double agc_db;
} idr_agc;

/* Navigation state output */
typedef struct {
  int64_t t_ns;
  double lat_deg;                  /* Estimated WGS-84 latitude */
  double lon_deg;                  /* Estimated WGS-84 longitude */
  double alt_m;                    /* Estimated altitude */
  double speed_mps;                /* Vehicle forward speed (m/s) */
  double speed_sigma_mps;          /* Speed uncertainty (1-sigma) */
  double heading_deg;              /* Vehicle true heading (0-360) */
  idr_nav_mode mode;               /* Navigation filter mode */
  idr_vehicle_mode vehicle_mode;   /* Active vehicle classifier */
  idr_align_state align_state;     /* Phone mount alignment status */
  double hpl_m;                    /* Horizontal Protection Level (k_H = 3.72) */
  double ell_major_m;              /* Error ellipse semi-major axis (m) */
  double ell_minor_m;              /* Error ellipse semi-minor axis (m) */
  double ell_angle_deg;            /* Error ellipse orientation (deg) */
  int64_t matched_way_id;          /* Current matched OSM way ID (0 if none) */
  int64_t matched_edge_id;         /* Current matched directed edge ID */
  double match_posterior;          /* HMM posterior probability */
  int floor_level;                 /* Parking floor level (0 = ground, negative = basement) */
  int flags;                       /* Bitmask: shock, slide, tunnel_armed, jamming */
} idr_state;

/* Discrete integrity and mode event */
typedef struct {
  int64_t t_ns;
  int type;                        /* Event type enumeration */
  double lat_deg;
  double lon_deg;
  char payload_json[512];          /* Compact JSON details */
} idr_event;

/* Opaque engine handle */
typedef struct idr_engine idr_engine;

/* Lifecycle and initialization */
IDR_API idr_engine* idr_create(const idr_config* config);
IDR_API int  idr_load_models(idr_engine* engine, const char* speed_onnx, const char* adapter_onnx);
IDR_API int  idr_load_map(idr_engine* engine, const char* map_sqlite, const char* user_sqlite);
IDR_API void idr_destroy(idr_engine* engine);

/* Sensor ingestion stream */
IDR_API void idr_push_imu(idr_engine* engine, const idr_imu* imu);
IDR_API void idr_push_mag(idr_engine* engine, const idr_mag* mag);
IDR_API void idr_push_baro(idr_engine* engine, const idr_baro* baro);
IDR_API void idr_push_fix(idr_engine* engine, const idr_fix* fix);
IDR_API void idr_push_gnss_status(idr_engine* engine, const idr_sat* sats, int n);
IDR_API void idr_push_agc(idr_engine* engine, const idr_agc* agc, int n);
IDR_API void idr_push_wheel_speed(idr_engine* engine, double speed_mps);

/* Stepper: processes pending 10 Hz / 1 Hz epochs */
IDR_API int  idr_step(idr_engine* engine, int64_t now_ns);

/* State querying and event polling */
IDR_API int  idr_get_state(const idr_engine* engine, idr_state* out);
IDR_API int  idr_poll_event(idr_engine* engine, idr_event* out);

/* Profile warm-start persistence */
IDR_API int  idr_profile_save(const idr_engine* engine, char* buf, int max_len);
IDR_API int  idr_profile_load(idr_engine* engine, const char* json);

#ifdef __cplusplus
}
#endif

#endif /* IDR_H */
