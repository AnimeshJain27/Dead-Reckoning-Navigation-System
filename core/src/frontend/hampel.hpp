// §3.2 Trailing Hampel Filter with Shock Detection
#ifndef IDR_FRONTEND_HAMPEL_HPP
#define IDR_FRONTEND_HAMPEL_HPP

#include "common/types.hpp"
#include <array>
#include <algorithm>
#include <cmath>

namespace idr::frontend {

// Trailing Hampel filter: fixed buffer, zero heap allocation
// K = 2 at 10 Hz (window 3), K = 20 at 200 Hz (window 21)
template <size_t CAPACITY = 25>
class HampelFilter {
public:
  explicit HampelFilter(size_t window_size = 3, double n_sigma = 3.0)
      : window_size_(std::min(window_size, CAPACITY)), n_sigma_(n_sigma) {
    reset();
  }

  void reset() {
    count_ = 0;
    head_ = 0;
    shock_flag_ = false;
  }

  // Process sample: returns cleaned sample and indicates shock flag
  double process(double x, bool& shock_detected) {
    buf_[head_] = x;
    head_ = (head_ + 1) % window_size_;
    if (count_ < window_size_) count_++;

    if (count_ < 3) {
      shock_detected = false;
      return x;
    }

    // Copy valid values for sorting
    std::array<double, CAPACITY> sorted;
    for (size_t i = 0; i < count_; ++i) {
      sorted[i] = buf_[i];
    }
    std::sort(sorted.begin(), sorted.begin() + count_);

    double median = (count_ % 2 == 1)
        ? sorted[count_ / 2]
        : 0.5 * (sorted[count_ / 2 - 1] + sorted[count_ / 2]);

    // Compute Median Absolute Deviation (MAD)
    std::array<double, CAPACITY> abs_devs;
    for (size_t i = 0; i < count_; ++i) {
      abs_devs[i] = std::abs(sorted[i] - median);
    }
    std::sort(abs_devs.begin(), abs_devs.begin() + count_);

    double mad = (count_ % 2 == 1)
        ? abs_devs[count_ / 2]
        : 0.5 * (abs_devs[count_ / 2 - 1] + abs_devs[count_ / 2]);

    // Scale MAD to standard deviation estimate (for Gaussian: 1.4826)
    double threshold = n_sigma_ * 1.4826 * (mad + 1e-6);

    double diff = std::abs(x - median);
    if (diff > threshold) {
      shock_detected = true;
      shock_flag_ = true;
      return median; // Replace with robust median
    }

    shock_detected = false;
    return x;
  }

  bool is_shock_active() const { return shock_flag_; }
  void clear_shock() { shock_flag_ = false; }

private:
  size_t window_size_{3};
  double n_sigma_{3.0};
  std::array<double, CAPACITY> buf_{};
  size_t count_{0};
  size_t head_{0};
  bool shock_flag_{false};
};

} // namespace idr::frontend

#endif // IDR_FRONTEND_HAMPEL_HPP
