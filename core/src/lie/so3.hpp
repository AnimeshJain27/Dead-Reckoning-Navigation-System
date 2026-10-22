// §4.1 SO(3) Lie Group & Lie Algebra
#ifndef IDR_LIE_SO3_HPP
#define IDR_LIE_SO3_HPP

#include "common/types.hpp"

namespace idr::lie {

// Skew-symmetric matrix [v]_x
inline Matrix3d skew(const Vector3d& v) {
  Matrix3d S;
  S <<    0.0, -v(2),  v(1),
         v(2),   0.0, -v(0),
        -v(1),  v(0),   0.0;
  return S;
}

// Rodrigues formula for SO(3) exponential map
inline Matrix3d exp_so3(const Vector3d& phi) {
  double theta = phi.norm();
  if (theta < 1e-7) {
    return Matrix3d::Identity() + skew(phi);
  }
  Vector3d axis = phi / theta;
  Matrix3d S = skew(axis);
  return Matrix3d::Identity() + std::sin(theta) * S + (1.0 - std::cos(theta)) * S * S;
}

// SO(3) logarithmic map
inline Vector3d log_so3(const Matrix3d& R) {
  double tr = R.trace();
  double cos_theta = (tr - 1.0) / 2.0;
  if (cos_theta > 1.0) cos_theta = 1.0;
  if (cos_theta < -1.0) cos_theta = -1.0;
  double theta = std::acos(cos_theta);
  if (theta < 1e-7) {
    return Vector3d(R(2,1) - R(1,2), R(0,2) - R(2,0), R(1,0) - R(0,1)) * 0.5;
  }
  double factor = theta / (2.0 * std::sin(theta));
  return Vector3d(R(2,1) - R(1,2), R(0,2) - R(2,0), R(1,0) - R(0,1)) * factor;
}

// Left Jacobian of SO(3)
inline Matrix3d left_jacobian(const Vector3d& phi) {
  double theta = phi.norm();
  if (theta < 1e-7) {
    return Matrix3d::Identity() + 0.5 * skew(phi);
  }
  Vector3d axis = phi / theta;
  Matrix3d S = skew(axis);
  return Matrix3d::Identity() + ((1.0 - std::cos(theta)) / theta) * S +
         ((theta - std::sin(theta)) / theta) * S * S;
}

} // namespace idr::lie

#endif // IDR_LIE_SO3_HPP
