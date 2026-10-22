// Unit test for Front-End Signal Conditioning (Hampel, Butterworth, Shock Gating)
#include <gtest/gtest.h>
#include "frontend/frontend.hpp"

using namespace idr;

TEST(FrontendTest, HampelRejectsOutlier) {
  frontend::HampelFilter<25> hampel(5, 3.0);
  bool shock = false;

  // Steady samples
  for (int i = 0; i < 5; ++i) {
    hampel.process(1.0, shock);
    EXPECT_FALSE(shock);
  }

  // Large outlier spike
  double cleaned = hampel.process(100.0, shock);
  EXPECT_TRUE(shock);
  EXPECT_LT(cleaned, 10.0); // Outlier was rejected and replaced by median
}

TEST(FrontendTest, ButterworthAttenuatesHighFreq) {
  frontend::Butterworth4thOrder filter;
  filter.design(4.0, 100.0); // 4 Hz cutoff @ 100 Hz sampling

  // Pass DC signal (0 Hz) -> gain ~= 1.0
  double dc_out = 0.0;
  for (int i = 0; i < 50; ++i) {
    dc_out = filter.process(1.0);
  }
  EXPECT_NEAR(dc_out, 1.0, 0.05);

  // High frequency signal (25 Hz) -> strongly attenuated
  filter.reset();
  double max_hf = 0.0;
  for (int i = 0; i < 100; ++i) {
    double t = i * 0.01;
    double x = std::sin(2.0 * PI * 25.0 * t);
    double y = filter.process(x);
    if (i > 50) {
      max_hf = std::max(max_hf, std::abs(y));
    }
  }
  EXPECT_LT(max_hf, 0.1); // > 20 dB attenuation
}
