// §4.1 SE_2(3) Extended Pose Lie Group (Orientation, Velocity, Position)
#ifndef IDR_LIE_SE23_HPP
#define IDR_LIE_SE23_HPP

#include "so3.hpp"

namespace idr::lie {

// SE_2(3) state element: Rotation R, Velocity v, Position p
struct SE23State {
  Matrix3d R{Matrix3d::Identity()};
  Vector3d v{Vector3d::Zero()};
  Vector3d p{Vector3d::Zero()};

  // Right group action: X * exp(xi)
  // xi = [xi_R(3), xi_v(3), xi_p(3)]
  SE23State right_multiply(const Vector3d& xi_R, const Vector3d& xi_v, const Vector3d& xi_p) const {
    SE23State out;
    Matrix3d dR = exp_so3(xi_R);
    out.R = R * dR;
    out.v = v + R * xi_v;
    out.p = p + R * xi_p;
    return out;
  }
};

// 9x9 Adjoint matrix of SE_2(3)
// Ad_X = [ R         0      0 ]
//        [ [v]_x R   R      0 ]
//        [ [p]_x R   0      R ]
inline Eigen::Matrix<double, 9, 9> adjoint_se23(const SE23State& X) {
  Eigen::Matrix<double, 9, 9> Ad = Eigen::Matrix<double, 9, 9>::Zero();
  Ad.block<3,3>(0,0) = X.R;
  Ad.block<3,3>(3,0) = skew(X.v) * X.R;
  Ad.block<3,3>(3,3) = X.R;
  Ad.block<3,3>(6,0) = skew(X.p) * X.R;
  Ad.block<3,3>(6,6) = X.R;
  return Ad;
}

} // namespace idr::lie

#endif // IDR_LIE_SE23_HPP
