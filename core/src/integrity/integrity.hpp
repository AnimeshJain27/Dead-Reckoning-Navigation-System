// §3.4 Deficit Handler, Interference Monitor & Horizontal Protection Level (HPL)
#ifndef IDR_INTEGRITY_INTEGRITY_HPP
#define IDR_INTEGRITY_INTEGRITY_HPP

#include "common/types.hpp"
#include <deque>
#include <cmath>
#include <algorithm>

namespace idr::integrity {

enum class NavMode {
  GNSS_OK    = 0,
  DEGRADED   = 1,
  DR         = 2,
  REACQ      = 3,
  SUSPECT_RF = 4
};

struct IntegrityReport {
  NavMode mode{NavMode::GNSS_OK};
  double hpl_m{5.0};
  bool jamming_detected{false};
  bool spoofing_detected{false};
  bool gate_rejected{false};
  double velocity_cusum{0.0};
  double fix_age_s{0.0};
};

class IntegrityMonitor {
public:
  IntegrityMonitor() {
    reset();
  }

  void reset() {
    mode_ = NavMode::GNSS_OK;
    time_since_last_fix_s_ = 0.0;
    degraded_timer_s_ = 0.0;
    cusum_v_ = 0.0;
    jamming_flag_ = false;
    last_accepted_fix_time_ns_ = 0;
  }

  // Pre-checks on incoming GNSS fix (§3.4)
  // r68 <= 20 m, num_sats >= 5, age <= 2.0 s, median C/N0 >= 25 dB-Hz
  bool pre_check_fix(const GnssFix& fix, double median_cn0_dbhz, int64_t now_ns) {
    if (!fix.valid) return false;
    if (fix.r68_m > 20.0) return false;
    if (fix.num_sats < 5) return false;

    double age_s = (now_ns - fix.t_ns) * 1e-9;
    if (age_s > 2.0 || age_s < -0.1) return false;

    if (median_cn0_dbhz > 0.0 && median_cn0_dbhz < 25.0) {
      return false; // Below 25 dB-Hz threshold (§1.1, §3.4)
    }

    return true;
  }

  // Update deficit handler state machine at 10 Hz (§3.4)
  IntegrityReport step(bool fix_attempted, bool fix_accepted, double pos_nis, double vel_residual_mps,
                       double median_cn0_dbhz, double agc_change_db, double hpl_m,
                       int64_t now_ns, double dt_s = 0.1) {
    IntegrityReport report;

    // Interference detection: C/N0 drops on all satellites while AGC moves (§1.1, §3.4)
    if (median_cn0_dbhz > 0.0 && median_cn0_dbhz < 25.0 && std::abs(agc_change_db) > 3.0) {
      jamming_flag_ = true;
    } else if (median_cn0_dbhz >= 30.0) {
      jamming_flag_ = false;
    }

    // Velocity CUSUM for spoofing detection: nu0 = 3 m/s, alarm threshold h = 20
    cusum_v_ = std::max(0.0, cusum_v_ + (std::abs(vel_residual_mps) - 3.0));
    bool spoofing_alarm = (cusum_v_ > 20.0);

    if (fix_accepted) {
      time_since_last_fix_s_ = 0.0;
      last_accepted_fix_time_ns_ = now_ns;

      if (mode_ == NavMode::DR) {
        // Fast path check (§3.4): r68 <= 5m and pos_nis <= 4.61 -> immediate GNSS_OK, else REACQ
        if (pos_nis <= 4.61) {
          mode_ = NavMode::GNSS_OK;
        } else {
          mode_ = NavMode::REACQ;
        }
      } else if (mode_ == NavMode::REACQ || mode_ == NavMode::DEGRADED) {
        mode_ = NavMode::GNSS_OK;
      }
    } else {
      time_since_last_fix_s_ += dt_s;

      if (fix_attempted) {
        // Fix failed pre-check or chi-squared gate (§3.4)
        if (mode_ == NavMode::GNSS_OK) {
          mode_ = NavMode::DEGRADED;
        }
      }

      // Mode transitions:
      // DR flag after 1.5 s without an accepted fix (§3.4)
      if (time_since_last_fix_s_ >= 1.5) {
        mode_ = NavMode::DR;
      }
    }

    // SUSPECT_RF state: persistent spoofing or jamming
    if (spoofing_alarm || jamming_flag_) {
      mode_ = NavMode::SUSPECT_RF;
    }

    report.mode = mode_;
    report.hpl_m = hpl_m;
    report.jamming_detected = jamming_flag_;
    report.spoofing_detected = spoofing_alarm;
    report.gate_rejected = (pos_nis > 13.8);
    report.velocity_cusum = cusum_v_;
    report.fix_age_s = time_since_last_fix_s_;

    return report;
  }

  NavMode mode() const { return mode_; }

private:
  NavMode mode_{NavMode::GNSS_OK};
  double time_since_last_fix_s_{0.0};
  double degraded_timer_s_{0.0};
  double cusum_v_{0.0};
  bool jamming_flag_{false};
  int64_t last_accepted_fix_time_ns_{0};
};

} // namespace idr::integrity

#endif // IDR_INTEGRITY_INTEGRITY_HPP
