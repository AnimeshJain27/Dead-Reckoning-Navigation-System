// §3.0 Common Mathematical & Matrix Types
#ifndef IDR_COMMON_TYPES_HPP
#define IDR_COMMON_TYPES_HPP

#include <Eigen/Dense>
#include <cstdint>
#include <cmath>

namespace idr {

constexpr double PI = 3.14159265358979323846;
constexpr double DEG2RAD = PI / 180.0;
constexpr double RAD2DEG = 180.0 / PI;
constexpr double STANDARD_GRAVITY = 9.80665; // m/s^2

// Fixed size Eigen vectors & matrices
using Vector2d = Eigen::Vector2d;
using Vector3d = Eigen::Vector3d;
using Vector6d = Eigen::Matrix<double, 6, 1>;
using Matrix2d = Eigen::Matrix2d;
using Matrix3d = Eigen::Matrix3d;
using Matrix6d = Eigen::Matrix<double, 6, 6>;
using Quaterniond = Eigen::Quaterniond;

// State dimensions: 23 error states for Right-Invariant IEKF (§3.4)
// xi_R (3), xi_v (3), xi_p (3), delta_b_omega (3), delta_b_a (3),
// xi_bv (3), delta_ell (2), delta_s (1), delta_b_m (2)
constexpr int STATE_DIM = 23;
using VectorState = Eigen::Matrix<double, STATE_DIM, 1>;
using MatrixState = Eigen::Matrix<double, STATE_DIM, STATE_DIM>;

// IMU measurement container
struct ImuSample {
  int64_t t_ns{0};
  Vector3d accel{Vector3d::Zero()};   // Specific force in body frame (m/s^2)
  Vector3d gyro{Vector3d::Zero()};    // Angular rate in body frame (rad/s)
};

// GNSS fix container
struct GnssFix {
  int64_t t_ns{0};
  int64_t utc_ms{0};
  double lat_deg{0.0};
  double lon_deg{0.0};
  double alt_m{0.0};
  double speed_mps{0.0};
  double bearing_deg{0.0};
  double r68_m{10.0};
  int num_sats{0};
  bool valid{false};
};

} // namespace idr

#endif // IDR_COMMON_TYPES_HPP
