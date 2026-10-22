// §3.2 Front-End Signal Conditioning: Hampel, Butterworth, Envelopes & Shock Gating
#ifndef IDR_FRONTEND_FRONTEND_HPP
#define IDR_FRONTEND_FRONTEND_HPP

#include "hampel.hpp"
#include "butterworth.hpp"

namespace idr::frontend {

struct FilteredImu {
  int64_t t_ns{0};
  Vector3d accel_hampel{Vector3d::Zero()};
  Vector3d gyro_hampel{Vector3d::Zero()};
  Vector3d accel_filtered{Vector3d::Zero()}; // 4 Hz low-passed
  Vector3d gyro_filtered{Vector3d::Zero()};  // 4 Hz low-passed
  bool shock_flag{false};
  double shock_time_remaining_s{0.0};
  // Log-envelopes (M=10)
  double env_accel_z{0.0}; // ell_fz
  double env_accel_y{0.0}; // ell_fy
  double env_gyro_x{0.0};  // ell_wx
};

class FrontendProcessor {
public:
  explicit FrontendProcessor(double sampling_rate_hz = 10.0)
      : rate_hz_(sampling_rate_hz), dt_s_(1.0 / sampling_rate_hz) {
    size_t hampel_k = (sampling_rate_hz > 50.0) ? 20 : 2;
    hampel_ax_ = HampelFilter<25>(2 * hampel_k + 1, 3.0);
    hampel_ay_ = HampelFilter<25>(2 * hampel_k + 1, 3.0);
    hampel_az_ = HampelFilter<25>(2 * hampel_k + 1, 3.0);
    hampel_gx_ = HampelFilter<25>(2 * hampel_k + 1, 3.0);
    hampel_gy_ = HampelFilter<25>(2 * hampel_k + 1, 3.0);
    hampel_gz_ = HampelFilter<25>(2 * hampel_k + 1, 3.0);

    accel_filter_.design(4.0, sampling_rate_hz);
    gyro_filter_.design(4.0, sampling_rate_hz);
  }

  void reset() {
    hampel_ax_.reset();
    hampel_ay_.reset();
    hampel_az_.reset();
    hampel_gx_.reset();
    hampel_gy_.reset();
    hampel_gz_.reset();
    accel_filter_.reset();
    gyro_filter_.reset();
    shock_active_ = false;
    shock_timer_s_ = 0.0;
    env_head_ = 0;
    env_count_ = 0;
  }

  FilteredImu process(const ImuSample& raw) {
    FilteredImu out;
    out.t_ns = raw.t_ns;

    // Step 1: Trailing Hampel outlier rejection
    bool s_ax, s_ay, s_az, s_gx, s_gy, s_gz;
    out.accel_hampel(0) = hampel_ax_.process(raw.accel(0), s_ax);
    out.accel_hampel(1) = hampel_ay_.process(raw.accel(1), s_ay);
    out.accel_hampel(2) = hampel_az_.process(raw.accel(2), s_az);
    out.gyro_hampel(0) = hampel_gx_.process(raw.gyro(0), s_gx);
    out.gyro_hampel(1) = hampel_gy_.process(raw.gyro(1), s_gy);
    out.gyro_hampel(2) = hampel_gz_.process(raw.gyro(2), s_gz);

    // Shock flag: 0.5 s skip of NHC & speed updates (§3.2)
    bool shock_now = s_ax || s_ay || s_az || s_gx || s_gy || s_gz;
    if (shock_now) {
      shock_active_ = true;
      shock_timer_s_ = 0.5; // Hold for 0.5 seconds
    } else if (shock_active_) {
      shock_timer_s_ -= dt_s_;
      if (shock_timer_s_ <= 0.0) {
        shock_active_ = false;
        shock_timer_s_ = 0.0;
      }
    }
    out.shock_flag = shock_active_;
    out.shock_time_remaining_s = shock_timer_s_;

    // Step 2: 4th-order Butterworth low-pass filter (4 Hz cut-off)
    out.accel_filtered = accel_filter_.process(out.accel_hampel);
    out.gyro_filtered = gyro_filter_.process(out.gyro_hampel);

    // Step 3: Log-envelopes (M=10) on vibration residuals (raw - filtered)
    Vector3d vib_accel = raw.accel - out.accel_filtered;
    Vector3d vib_gyro = raw.gyro - out.gyro_filtered;

    env_buf_az_[env_head_] = std::abs(vib_accel(2));
    env_buf_ay_[env_head_] = std::abs(vib_accel(1));
    env_buf_gx_[env_head_] = std::abs(vib_gyro(0));
    env_head_ = (env_head_ + 1) % 10;
    if (env_count_ < 10) env_count_++;

    double mean_az = 0.0, mean_ay = 0.0, mean_gx = 0.0;
    for (size_t i = 0; i < env_count_; ++i) {
      mean_az += env_buf_az_[i];
      mean_ay += env_buf_ay_[i];
      mean_gx += env_buf_gx_[i];
    }
    mean_az /= env_count_;
    mean_ay /= env_count_;
    mean_gx /= env_count_;

    out.env_accel_z = std::log10(mean_az + 1e-4);
    out.env_accel_y = std::log10(mean_ay + 1e-4);
    out.env_gyro_x = std::log10(mean_gx + 1e-4);

    return out;
  }

  bool is_shock() const { return shock_active_; }

private:
  double rate_hz_{10.0};
  double dt_s_{0.1};

  HampelFilter<25> hampel_ax_;
  HampelFilter<25> hampel_ay_;
  HampelFilter<25> hampel_az_;
  HampelFilter<25> hampel_gx_;
  HampelFilter<25> hampel_gy_;
  HampelFilter<25> hampel_gz_;

  Vector3Butterworth accel_filter_;
  Vector3Butterworth gyro_filter_;

  bool shock_active_{false};
  double shock_timer_s_{0.0};

  // Envelope buffer (M=10)
  std::array<double, 10> env_buf_az_{};
  std::array<double, 10> env_buf_ay_{};
  std::array<double, 10> env_buf_gx_{};
  size_t env_head_{0};
  size_t env_count_{0};
};

} // namespace idr::frontend

#endif // IDR_FRONTEND_FRONTEND_HPP
