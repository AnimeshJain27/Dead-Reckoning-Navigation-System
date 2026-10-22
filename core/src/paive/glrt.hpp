// §3.2 GLRT Stop Detector, ZUPT/ZARU & Reverse Detector
#ifndef IDR_PAIVE_GLRT_HPP
#define IDR_PAIVE_GLRT_HPP

#include "common/types.hpp"
#include <deque>
#include <numeric>

namespace idr::paive {

class GlrtStopDetector {
public:
  // W=10 @ 10 Hz, calibrated for consumer phone IMUs (§3.2)
  explicit GlrtStopDetector(size_t window_size = 10, double gamma = 25.0,
                            double sigma_a = 0.15, double sigma_omega = 0.05)
      : W_(window_size), gamma_(gamma),
        sigma_a2_(sigma_a * sigma_a), sigma_omega2_(sigma_omega * sigma_omega) {
    reset();
  }

  void reset() {
    is_stationary_ = true;
    accel_window_.clear();
    gyro_window_.clear();
    stop_timer_s_ = 0.0;
    move_timer_s_ = 0.0;
    reverse_flag_ = false;
    reverse_eval_timer_s_ = 0.0;
  }

  // Process IMU sample and learned speed estimate (mu, sigma)
  // Returns true if vehicle is stationary
  bool process(const Vector3d& f_body, const Vector3d& omega_body,
               double mu_speed, double sigma_speed, double dt_s = 0.1) {
    accel_window_.push_back(f_body);
    gyro_window_.push_back(omega_body);
    if (accel_window_.size() > W_) accel_window_.pop_front();
    if (gyro_window_.size() > W_) gyro_window_.pop_front();

    if (accel_window_.size() < W_) {
      return is_stationary_;
    }

    // Compute mean specific force f_bar and angular velocity omega_bar
    Vector3d f_bar = Vector3d::Zero();
    Vector3d omega_bar = Vector3d::Zero();
    for (size_t i = 0; i < W_; ++i) {
      f_bar += accel_window_[i];
      omega_bar += gyro_window_[i];
    }
    f_bar /= static_cast<double>(W_);
    omega_bar /= static_cast<double>(W_);

    // Compute GLRT statistic T_k:
    // T_k = (1/W) * sum [ (1/sigma_a^2) * ||f_i - g * (f_bar / ||f_bar||)||^2 + (1/sigma_omega^2) * ||omega_i||^2 ]
    Vector3d g_dir = f_bar.normalized() * STANDARD_GRAVITY;
    double T_k = 0.0;
    for (size_t i = 0; i < W_; ++i) {
      Vector3d df = accel_window_[i] - g_dir;
      Vector3d domega = gyro_window_[i] - omega_bar;
      T_k += (df.squaredNorm() / sigma_a2_) + (domega.squaredNorm() / sigma_omega2_);
    }
    T_k /= static_cast<double>(W_);

    double yaw_rate = std::abs(omega_body(2));

    if (!is_stationary_) {
      // MOVING -> STATIONARY transition condition:
      // T_k < gamma for 1.0 s, yaw rate within +-0.02 rad/s, and mu_k + 2*sigma_k < 0.5 m/s
      bool speed_stopped = (mu_speed + 2.0 * sigma_speed) < 0.5;
      if (T_k < gamma_ && yaw_rate < 0.02 && speed_stopped) {
        stop_timer_s_ += dt_s;
        if (stop_timer_s_ >= 1.0) {
          is_stationary_ = true;
          stop_timer_s_ = 0.0;
          reverse_flag_ = false;
        }
      } else {
        stop_timer_s_ = 0.0;
      }
    } else {
      // STATIONARY -> MOVING transition condition:
      // T_k > 1.5*gamma for 0.2 s, OR immediately if mu_k - 2*sigma_k > 1.0 m/s
      bool immediate_move = (mu_speed - 2.0 * sigma_speed) > 1.0;
      if (T_k > 1.5 * gamma_) {
        move_timer_s_ += dt_s;
      } else {
        move_timer_s_ = 0.0;
      }

      if (immediate_move || move_timer_s_ >= 0.2) {
        is_stationary_ = false;
        move_timer_s_ = 0.0;
        // Start reverse detector evaluation over first 0.5 s of motion (§3.2)
        reverse_eval_timer_s_ = 0.5;
      }
    }

    // Reverse detector evaluation during initial 0.5 s of movement
    if (!is_stationary_ && reverse_eval_timer_s_ > 0.0) {
      reverse_eval_timer_s_ -= dt_s;
      // Negative specific force along vehicle longitudinal axis indicates reversing
      if (f_body(0) < -0.15) {
        reverse_flag_ = true;
      }
    }

    return is_stationary_;
  }

  bool is_stationary() const { return is_stationary_; }
  bool is_reversing() const { return reverse_flag_; }

private:
  size_t W_{10};
  double gamma_{8.60};
  double sigma_a2_{0.0064};
  double sigma_omega2_{0.0001};

  bool is_stationary_{true};
  bool reverse_flag_{false};
  double stop_timer_s_{0.0};
  double move_timer_s_{0.0};
  double reverse_eval_timer_s_{0.0};

  std::deque<Vector3d> accel_window_;
  std::deque<Vector3d> gyro_window_;
};

} // namespace idr::paive

#endif // IDR_PAIVE_GLRT_HPP
