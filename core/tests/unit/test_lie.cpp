// Unit test for SO(3) & SE_2(3) Lie Algebra
#include <gtest/gtest.h>
#include "lie/so3.hpp"
#include "lie/se23.hpp"

using namespace idr;

TEST(LieTest, So3ExpLogIdentity) {
  Vector3d phi(0.1, -0.2, 0.3);
  Matrix3d R = lie::exp_so3(phi);
  Vector3d phi_recovered = lie::log_so3(R);

  EXPECT_NEAR((phi - phi_recovered).norm(), 0.0, 1e-6);
}

TEST(LieTest, So3ZeroVector) {
  Vector3d zero = Vector3d::Zero();
  Matrix3d R = lie::exp_so3(zero);
  EXPECT_TRUE(R.isApprox(Matrix3d::Identity(), 1e-9));

  Vector3d recovered = lie::log_so3(R);
  EXPECT_TRUE(recovered.isApprox(Vector3d::Zero(), 1e-9));
}

TEST(LieTest, Se23RightMultiply) {
  lie::SE23State state;
  state.R = Matrix3d::Identity();
  state.v = Vector3d(10.0, 0.0, 0.0);
  state.p = Vector3d(100.0, 200.0, 10.0);

  Vector3d xi_R(0.0, 0.0, 0.1);
  Vector3d xi_v(1.0, 0.0, 0.0);
  Vector3d xi_p(5.0, 0.0, 0.0);

  lie::SE23State next = state.right_multiply(xi_R, xi_v, xi_p);
  EXPECT_NEAR(next.p(0), 105.0, 1e-6);
  EXPECT_NEAR(next.v(0), 11.0, 1e-6);
}
