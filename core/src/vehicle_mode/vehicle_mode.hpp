// §2.4 Vehicle Mode Classification (Wald SPRT), Lean Decoupling & Slide Gating
#ifndef IDR_VEHICLE_MODE_HPP
#define IDR_VEHICLE_MODE_HPP

#include "common/types.hpp"
#include <deque>
#include <cmath>

namespace idr::vehicle_mode {

enum class VehicleMode {
  CAR = 0,
  TWO_WHEELER = 1
};

class VehicleModeClassifier {
public:
  VehicleModeClassifier() {
    reset();
  }

  void reset() {
    mode_ = VehicleMode::CAR;
    sprt_log_ratio_ = 0.0;
    slide_flag_ = false;
    slide_clear_timer_s_ = 0.0;
    side_slip_history_.clear();
  }

  // Wald Sequential Probability Ratio Test (SPRT) on turn samples (§2.4)
  // alpha = beta = 0.01 -> upper threshold +4.605, lower threshold -4.605
  // Car exhibits outward roll: roll ~= K_phi * a_y (K_phi ~= 4.5 deg/g)
  // Two-wheeler exhibits inward lean: roll ~= -atan(a_y / g)
  void update_sprt(double a_lat_mps2, double roll_rate_radps, double yaw_rate_radps) {
    if (std::abs(yaw_rate_radps) < 0.03 || std::abs(a_lat_mps2) < 0.5) {
      return; // Only sample during noticeable turning
    }

    // Centrifugal sign: positive a_lat with positive yaw_rate
    double centripetal_accel = a_lat_mps2;

    // Log-likelihood increment:
    // Car: roll rate opposes lateral jerk
    // Two-wheeler: active inward lean initiation
    double car_score = (centripetal_accel * roll_rate_radps > 0) ? -0.5 : 0.5;
    double two_wheeler_score = -car_score;

    sprt_log_ratio_ += (two_wheeler_score - car_score);

    if (sprt_log_ratio_ >= 4.605) {
      mode_ = VehicleMode::TWO_WHEELER;
      sprt_log_ratio_ = 4.605;
    } else if (sprt_log_ratio_ <= -4.605) {
      mode_ = VehicleMode::CAR;
      sprt_log_ratio_ = -4.605;
    }
  }

  // Slide Gate (§2.4)
  // Evaluates side-slip rate nu_k in heading frame
  // Flags slide if mean of last 5 values exceeds 3*sigma_nu
  bool update_slide_gate(double side_slip_nu, double sigma_nu = 0.15, double dt_s = 0.1) {
    side_slip_history_.push_back(side_slip_nu);
    if (side_slip_history_.size() > 5) {
      side_slip_history_.pop_front();
    }

    if (side_slip_history_.size() == 5) {
      double mean_slip = 0.0;
      for (double val : side_slip_history_) {
        mean_slip += val;
      }
      mean_slip /= 5.0;

      if (std::abs(mean_slip) > 3.0 * sigma_nu) {
        slide_flag_ = true;
        slide_clear_timer_s_ = 1.0;
      } else if (slide_flag_) {
        if (std::abs(mean_slip) < sigma_nu) {
          slide_clear_timer_s_ -= dt_s;
          if (slide_clear_timer_s_ <= 0.0) {
            slide_flag_ = false;
            slide_clear_timer_s_ = 0.0;
          }
        }
      }
    }
    return slide_flag_;
  }

  VehicleMode mode() const { return mode_; }
  bool is_sliding() const { return slide_flag_; }
  double sprt_score() const { return sprt_log_ratio_; }

private:
  VehicleMode mode_{VehicleMode::CAR};
  double sprt_log_ratio_{0.0};
  bool slide_flag_{false};
  double slide_clear_timer_s_{0.0};
  std::deque<double> side_slip_history_;
};

} // namespace idr::vehicle_mode

#endif // IDR_VEHICLE_MODE_HPP
