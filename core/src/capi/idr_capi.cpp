// §3.1 C API Surface Implementation
#include "idr/idr.h"
#include "engine/engine.hpp"

struct idr_engine {
  std::unique_ptr<idr::engine::NavigationEngine> impl;
};

idr_engine* idr_create(const idr_config* config) {
  if (!config) return nullptr;
  auto* eng = new idr_engine();
  eng->impl = std::make_unique<idr::engine::NavigationEngine>(*config);
  return eng;
}

int idr_load_models(idr_engine* engine, const char* speed_onnx, const char* adapter_onnx) {
  if (!engine || !engine->impl || !speed_onnx || !adapter_onnx) return -1;
  return engine->impl->load_models(speed_onnx, adapter_onnx) ? 0 : -1;
}

int idr_load_map(idr_engine* engine, const char* map_sqlite, const char* user_sqlite) {
  if (!engine || !engine->impl || !map_sqlite) return -1;
  return engine->impl->load_map(map_sqlite, user_sqlite ? user_sqlite : "") ? 0 : -1;
}

void idr_push_imu(idr_engine* engine, const idr_imu* imu) {
  if (engine && engine->impl && imu) {
    engine->impl->push_imu(*imu);
  }
}

void idr_push_mag(idr_engine* engine, const idr_mag* mag) {
  if (engine && engine->impl && mag) {
    engine->impl->push_mag(*mag);
  }
}

void idr_push_baro(idr_engine* engine, const idr_baro* baro) {
  if (engine && engine->impl && baro) {
    engine->impl->push_baro(*baro);
  }
}

void idr_push_fix(idr_engine* engine, const idr_fix* fix) {
  if (engine && engine->impl && fix) {
    engine->impl->push_fix(*fix);
  }
}

void idr_push_gnss_status(idr_engine* engine, const idr_sat* sats, int n) {
  if (engine && engine->impl && sats && n > 0) {
    engine->impl->push_gnss_status(sats, n);
  }
}

void idr_push_agc(idr_engine* engine, const idr_agc* agc, int n) {
  if (engine && engine->impl && agc && n > 0) {
    engine->impl->push_agc(agc, n);
  }
}

void idr_push_wheel_speed(idr_engine* engine, double speed_mps) {
  if (engine && engine->impl) {
    engine->impl->push_wheel_speed(speed_mps);
  }
}

int idr_step(idr_engine* engine, int64_t now_ns) {
  if (!engine || !engine->impl) return -1;
  return engine->impl->step(now_ns);
}

int idr_get_state(const idr_engine* engine, idr_state* out) {
  if (!engine || !engine->impl || !out) return -1;
  return engine->impl->get_state(*out);
}

int idr_poll_event(idr_engine* engine, idr_event* out) {
  if (!engine || !engine->impl || !out) return -1;
  return engine->impl->poll_event(*out);
}

int idr_profile_save(const idr_engine* engine, char* buf, int max_len) {
  if (!engine || !engine->impl) return -1;
  return engine->impl->save_profile(buf, max_len);
}

int idr_profile_load(idr_engine* engine, const char* json) {
  if (!engine || !engine->impl || !json) return -1;
  return engine->impl->load_profile(json);
}

void idr_destroy(idr_engine* engine) {
  if (engine) {
    delete engine;
  }
}
