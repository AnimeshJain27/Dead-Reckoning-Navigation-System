// §3.0 Top-Level Navigation Engine Orchestrator
#ifndef IDR_ENGINE_ENGINE_HPP
#define IDR_ENGINE_ENGINE_HPP

#include "idr/idr.h"
#include "common/types.hpp"
#include "frontend/frontend.hpp"
#include "alignment/alignment.hpp"
#include "paive/glrt.hpp"
#include "paive/speed_tcn.hpp"
#include "vehicle_mode/vehicle_mode.hpp"
#include "filter/iekf.hpp"
#include "filter/noise_adapter.hpp"
#include "mapmatch/mapmatch.hpp"
#include "integrity/integrity.hpp"
#include "geo/geodesic.hpp"
#include <mutex>
#include <deque>

namespace idr::engine {

class NavigationEngine {
public:
  explicit NavigationEngine(const idr_config& config);
  ~NavigationEngine() = default;

  bool load_models(const std::string& speed_onnx, const std::string& adapter_onnx);
  bool load_map(const std::string& map_sqlite, const std::string& user_sqlite);

  void push_imu(const idr_imu& imu);
  void push_mag(const idr_mag& mag);
  void push_baro(const idr_baro& baro);
  void push_fix(const idr_fix& fix);
  void push_gnss_status(const idr_sat* sats, int n);
  void push_agc(const idr_agc* agc, int n);
  void push_wheel_speed(double speed_mps);

  int step(int64_t now_ns);
  int get_state(idr_state& out) const;
  int poll_event(idr_event& out);

  int save_profile(char* buf, int max_len) const;
  int load_profile(const char* json);

private:
  void run_10hz_cycle(int64_t now_ns);
  void emit_event(int type, double lat, double lon, const std::string& payload);

  idr_config config_;
  mutable std::mutex mutex_;

  frontend::FrontendProcessor frontend_;
  alignment::AlignmentEngine alignment_;
  paive::GlrtStopDetector glrt_;
  paive::SpeedTcnRunner speed_tcn_;
  vehicle_mode::VehicleModeClassifier vehicle_classifier_;
  filter::RightInvariantIEKF main_filter_;
  filter::RightInvariantIEKF shadow_filter_; // Map-free shadow filter (§3.4)
  filter::NoiseAdapterRunner noise_adapter_;
  mapmatch::MapMatcher map_matcher_;
  integrity::IntegrityMonitor integrity_monitor_;
  geo::LocalTangentPlane tangent_plane_;

  // Buffer state
  std::deque<ImuSample> imu_buffer_;
  GnssFix latest_fix_;
  bool has_new_fix_{false};
  double median_cn0_dbhz_{35.0};
  double agc_change_db_{0.0};
  double wheel_speed_mps_{0.0};
  bool has_wheel_speed_{false};

  idr_state current_state_{};
  std::deque<idr_event> event_queue_;

  int64_t last_step_ns_{0};
  int64_t last_10hz_ns_{0};
};

} // namespace idr::engine

#endif // IDR_ENGINE_ENGINE_HPP
