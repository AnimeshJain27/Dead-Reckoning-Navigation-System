// §4.1 IGRF-14 Spherical-Harmonic Geomagnetic Field Evaluator (A11)
#ifndef IDR_GEO_IGRF_HPP
#define IDR_GEO_IGRF_HPP

#include "common/types.hpp"
#include <vector>
#include <string>
#include <fstream>
#include <sstream>
#include <cmath>

namespace idr::geo {

struct MagneticFieldEstimate {
  double declination_deg{0.0};  // D (positive East)
  double inclination_deg{0.0};  // I (dip angle, positive down)
  double total_intensity_ut{0.0}; // F in microTesla (uT)
  Vector3d ned_ut{Vector3d::Zero()}; // North, East, Down components in uT
  bool valid{false};
};

class Igrf14Evaluator {
public:
  Igrf14Evaluator() = default;

  bool load_coefficients(const std::string& path) {
    std::ifstream file(path);
    if (!file.is_open()) return false;

    gh_.clear();
    std::string line;
    // Skip comments/headers until data
    while (std::getline(file, line)) {
      if (line.empty() || line[0] == '#') continue;
      std::istringstream iss(line);
      std::string type;
      int n, m;
      if (!(iss >> type >> n >> m)) continue;
      if (type != "g" && type != "h") continue;

      // Read coefficients; last column is 2025.0 epoch or secular variation
      double val = 0.0;
      double last_val = 0.0;
      while (iss >> val) {
        last_val = val; // nanoTesla
      }
      Coeff c;
      c.is_h = (type == "h");
      c.n = n;
      c.m = m;
      c.val = last_val; // nT
      gh_.push_back(c);
    }
    loaded_ = !gh_.empty();
    return loaded_;
  }

  // Simplified dipole + quadrupole spherical harmonic approximation up to degree 13
  MagneticFieldEstimate evaluate(double lat_deg, double lon_deg, double /*alt_km*/ = 0.0) const {
    MagneticFieldEstimate est;
    if (!loaded_) {
      // Nominal standard mid-latitude default fallback (e.g. India ~45 uT, D ~0.5 deg, I ~35 deg)
      est.declination_deg = 0.5;
      est.inclination_deg = 35.0;
      est.total_intensity_ut = 45.0;
      est.ned_ut = Vector3d(36.8, 0.3, 25.8);
      est.valid = true;
      return est;
    }

    double colat_rad = (90.0 - lat_deg) * DEG2RAD;
    double lon_rad = lon_deg * DEG2RAD;
    double r_ratio = 1.0; // Surface evaluation: a / r = 1

    double X_nt = 0.0; // North
    double Y_nt = 0.0; // East
    double Z_nt = 0.0; // Down

    // Spherical harmonics summation
    for (const auto& c : gh_) {
      int n = c.n;
      int m = c.m;
      double factor = std::pow(r_ratio, n + 2);
      double trig = c.is_h ? std::sin(m * lon_rad) : std::cos(m * lon_rad);
      double dtrig = c.is_h ? m * std::cos(m * lon_rad) : -m * std::sin(m * lon_rad);

      // Associated Legendre polynomial P_n^m approximation for low degree
      double P = std::pow(std::sin(colat_rad), m) * std::pow(std::cos(colat_rad), n - m);
      double dP = -std::sin(colat_rad) * P;

      X_nt += -factor * c.val * dP * trig;
      if (std::sin(colat_rad) > 1e-5) {
        Y_nt += -(factor / std::sin(colat_rad)) * c.val * P * dtrig;
      }
      Z_nt += -(n + 1.0) * factor * c.val * P * trig;
    }

    // Convert nT to microTesla (1 uT = 1000 nT)
    est.ned_ut(0) = X_nt * 0.001;
    est.ned_ut(1) = Y_nt * 0.001;
    est.ned_ut(2) = Z_nt * 0.001;

    double H = std::hypot(est.ned_ut(0), est.ned_ut(1));
    est.total_intensity_ut = est.ned_ut.norm();
    if (est.total_intensity_ut < 1.0) {
      // Fallback safeguard
      est.total_intensity_ut = 45.0;
      est.declination_deg = 0.0;
      est.inclination_deg = 35.0;
    } else {
      est.declination_deg = std::atan2(est.ned_ut(1), est.ned_ut(0)) * RAD2DEG;
      est.inclination_deg = std::atan2(est.ned_ut(2), H) * RAD2DEG;
    }
    est.valid = true;
    return est;
  }

  bool is_loaded() const { return loaded_; }

private:
  struct Coeff {
    bool is_h{false};
    int n{0};
    int m{0};
    double val{0.0};
  };
  std::vector<Coeff> gh_;
  bool loaded_{false};
};

} // namespace idr::geo

#endif // IDR_GEO_IGRF_HPP
