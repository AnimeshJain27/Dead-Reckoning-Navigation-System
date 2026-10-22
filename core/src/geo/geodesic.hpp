// §3.4 & §4.1 Local Cartesian Tangent Plane & Re-anchoring
#ifndef IDR_GEO_GEODESIC_HPP
#define IDR_GEO_GEODESIC_HPP

#include "common/types.hpp"
#include <GeographicLib/LocalCartesian.hpp>
#include <GeographicLib/Geodesic.hpp>

namespace idr::geo {

class LocalTangentPlane {
public:
  LocalTangentPlane() = default;

  void reset(double lat0_deg, double lon0_deg, double h0_m = 0.0) {
    origin_lat_deg_ = lat0_deg;
    origin_lon_deg_ = lon0_deg;
    origin_h_m_ = h0_m;
    cartesian_.Reset(origin_lat_deg_, origin_lon_deg_, origin_h_m_);
    initialized_ = true;
  }

  bool is_initialized() const { return initialized_; }

  // Forward: WGS-84 -> local ENU (East, North, Up) in meters
  Vector3d forward(double lat_deg, double lon_deg, double h_m = 0.0) const {
    if (!initialized_) return Vector3d::Zero();
    double x, y, z;
    cartesian_.Forward(lat_deg, lon_deg, h_m, x, y, z);
    return Vector3d(x, y, z);
  }

  // Reverse: local ENU (East, North, Up) -> WGS-84 (lat, lon, h)
  void reverse(const Vector3d& enu_m, double& lat_deg, double& lon_deg, double& h_m) const {
    if (!initialized_) {
      lat_deg = origin_lat_deg_;
      lon_deg = origin_lon_deg_;
      h_m = origin_h_m_;
      return;
    }
    cartesian_.Reverse(enu_m(0), enu_m(1), enu_m(2), lat_deg, lon_deg, h_m);
  }

  // Distance from current origin in horizontal plane (m)
  double distance_from_origin(const Vector3d& enu_m) const {
    return std::hypot(enu_m(0), enu_m(1));
  }

  // Re-anchoring check: return true if horizontal distance exceeds 5 km (§3.4)
  bool needs_reanchor(const Vector3d& enu_m, double threshold_m = 5000.0) const {
    return distance_from_origin(enu_m) >= threshold_m;
  }

  double origin_lat() const { return origin_lat_deg_; }
  double origin_lon() const { return origin_lon_deg_; }

private:
  double origin_lat_deg_{0.0};
  double origin_lon_deg_{0.0};
  double origin_h_m_{0.0};
  GeographicLib::LocalCartesian cartesian_;
  bool initialized_{false};
};

// Geodesic distance and forward/reverse azimuth between two points on WGS-84
inline double geodesic_distance(double lat1, double lon1, double lat2, double lon2, double* azi1 = nullptr, double* azi2 = nullptr) {
  const GeographicLib::Geodesic& geod = GeographicLib::Geodesic::WGS84();
  double s12, a1, a2;
  geod.Inverse(lat1, lon1, lat2, lon2, s12, a1, a2);
  if (azi1) *azi1 = a1;
  if (azi2) *azi2 = a2;
  return s12;
}

} // namespace idr::geo

#endif // IDR_GEO_GEODESIC_HPP
