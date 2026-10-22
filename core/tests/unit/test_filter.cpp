// Unit test for Right-Invariant IEKF on SE_2(3)
#include <gtest/gtest.h>
#include "filter/iekf.hpp"

using namespace idr;

TEST(FilterTest, PredictionMaintainsPlausibility) {
  filter::RightInvariantIEKF iekf;

  Vector3d accel(0.0, 0.0, STANDARD_GRAVITY);
  Vector3d gyro(0.0, 0.0, 0.0);

  for (int i = 0; i < 10; ++i) {
    iekf.predict(accel, gyro, 0.1);
  }

  // Pure vertical gravity specific force -> vehicle remains near zero velocity
  EXPECT_LT(iekf.state().v.norm(), 0.05);
  EXPECT_GT(iekf.compute_hpl(), 0.0);
}

TEST(FilterTest, ZuptArrestsVelocity) {
  filter::RightInvariantIEKF iekf;
  iekf.mutable_state().v = Vector3d(5.0, 0.0, 0.0);

  iekf.update_zupt(0.01);
  EXPECT_LT(iekf.state().v.norm(), 0.1);
}

TEST(FilterTest, HplCalculation) {
  filter::RightInvariantIEKF iekf;
  double hpl = iekf.compute_hpl(3.72);
  EXPECT_GT(hpl, 1.0);
  EXPECT_LT(hpl, 50.0);
}
