// §3.2 4th-order Butterworth Low-Pass Filter (4 Hz cut-off)
#ifndef IDR_FRONTEND_BUTTERWORTH_HPP
#define IDR_FRONTEND_BUTTERWORTH_HPP

#include "common/types.hpp"
#include <array>
#include <cmath>

namespace idr::frontend {

// Single Biquad (Second Order Section) using Direct Form II Transposed
class BiquadSOS {
public:
  BiquadSOS() = default;

  void set_coefficients(double b0, double b1, double b2, double a1, double a2) {
    b0_ = b0; b1_ = b1; b2_ = b2;
    a1_ = a1; a2_ = a2;
    w1_ = 0.0; w2_ = 0.0;
  }

  void reset() {
    w1_ = 0.0;
    w2_ = 0.0;
  }

  double process(double x) {
    // Direct Form II Transposed:
    // y[n] = b0 * x[n] + w1[n-1]
    // w1[n] = b1 * x[n] - a1 * y[n] + w2[n-1]
    // w2[n] = b2 * x[n] - a2 * y[n]
    double y = b0_ * x + w1_;
    w1_ = b1_ * x - a1_ * y + w2_;
    w2_ = b2_ * x - a2_ * y;
    return y;
  }

private:
  double b0_{1.0}, b1_{0.0}, b2_{0.0};
  double a1_{0.0}, a2_{0.0};
  double w1_{0.0}, w2_{0.0};
};

// 4th-order Butterworth Low-Pass Filter cascaded from 2 Biquad SOS
class Butterworth4thOrder {
public:
  Butterworth4thOrder() {
    // Design for fc = 4 Hz at fs = 10 Hz (nominal)
    design(4.0, 10.0);
  }

  // Bilinear transform design of 4th order Butterworth filter
  void design(double fc_hz, double fs_hz) {
    // Pre-warp frequency
    double wa = 2.0 * fs_hz * std::tan(PI * fc_hz / fs_hz);
    // Two 2nd-order stages Q factors for 4th order: Q1 = 0.541196, Q2 = 1.306563
    configure_stage(sos1_, wa, fs_hz, 0.5411961);
    configure_stage(sos2_, wa, fs_hz, 1.3065630);
  }

  void reset() {
    sos1_.reset();
    sos2_.reset();
  }

  double process(double x) {
    return sos2_.process(sos1_.process(x));
  }

private:
  void configure_stage(BiquadSOS& sos, double wa, double fs, double Q) {
    double T = 1.0 / fs;
    double wa2 = wa * wa;
    double denom = 4.0 / (T * T) + 2.0 * wa / (Q * T) + wa2;

    double b0 = wa2 / denom;
    double b1 = 2.0 * wa2 / denom;
    double b2 = wa2 / denom;

    double a1 = (2.0 * wa2 - 8.0 / (T * T)) / denom;
    double a2 = (4.0 / (T * T) - 2.0 * wa / (Q * T) + wa2) / denom;

    sos.set_coefficients(b0, b1, b2, a1, a2);
  }

  BiquadSOS sos1_;
  BiquadSOS sos2_;
};

// 3-axis Butterworth filter
class Vector3Butterworth {
public:
  Vector3Butterworth() = default;

  void design(double fc_hz, double fs_hz) {
    fx_.design(fc_hz, fs_hz);
    fy_.design(fc_hz, fs_hz);
    fz_.design(fc_hz, fs_hz);
  }

  void reset() {
    fx_.reset();
    fy_.reset();
    fz_.reset();
  }

  Vector3d process(const Vector3d& v) {
    return Vector3d(fx_.process(v(0)), fy_.process(v(1)), fz_.process(v(2)));
  }

private:
  Butterworth4thOrder fx_, fy_, fz_;
};

} // namespace idr::frontend

#endif // IDR_FRONTEND_BUTTERWORTH_HPP
