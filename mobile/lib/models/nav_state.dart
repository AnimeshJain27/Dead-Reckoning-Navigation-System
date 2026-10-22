enum NavMode {
  gnssOk,
  degraded,
  dr,
  reacq,
  suspectRf,
}

enum VehicleClass {
  car,
  twoWheeler,
}

class NavState {
  final int tNs;
  final double lat;
  final double lon;
  final double alt;
  final double speedMps;
  final double headingDeg;
  final NavMode mode;
  final VehicleClass vehicleMode;
  final double hplM;
  final double ellMajorM;
  final double ellMinorM;
  final int wayId;

  const NavState({
    required this.tNs,
    required this.lat,
    required this.lon,
    required this.alt,
    required this.speedMps,
    required this.headingDeg,
    required this.mode,
    required this.vehicleMode,
    required this.hplM,
    required this.ellMajorM,
    required this.ellMinorM,
    required this.wayId,
  });

  double get speedKmh => speedMps * 3.6;

  bool get isDr => mode == NavMode.dr;

  String get modeString {
    switch (mode) {
      case NavMode.gnssOk:
        return "GNSS OK";
      case NavMode.degraded:
        return "GNSS DEGRADED";
      case NavMode.dr:
        return "DEAD RECKONING";
      case NavMode.reacq:
        return "RE-ACQUIRING";
      case NavMode.suspectRf:
        return "RF SPOOFING ALARM";
    }
  }

  factory NavState.fromMap(Map<dynamic, dynamic> map) {
    final modeInt = (map['mode'] as num?)?.toInt() ?? 0;
    final vehInt = (map['vehicle_mode'] as num?)?.toInt() ?? 0;

    return NavState(
      tNs: (map['t_ns'] as num?)?.toInt() ?? 0,
      lat: (map['lat'] as num?)?.toDouble() ?? 0.0,
      lon: (map['lon'] as num?)?.toDouble() ?? 0.0,
      alt: (map['alt'] as num?)?.toDouble() ?? 0.0,
      speedMps: (map['speed_mps'] as num?)?.toDouble() ?? 0.0,
      headingDeg: (map['heading_deg'] as num?)?.toDouble() ?? 0.0,
      mode: NavMode.values.elementAtOrNull(modeInt) ?? NavMode.gnssOk,
      vehicleMode: vehInt == 1 ? VehicleClass.twoWheeler : VehicleClass.car,
      hplM: (map['hpl_m'] as num?)?.toDouble() ?? 20.0,
      ellMajorM: (map['ell_major_m'] as num?)?.toDouble() ?? 5.0,
      ellMinorM: (map['ell_minor_m'] as num?)?.toDouble() ?? 3.0,
      wayId: (map['way_id'] as num?)?.toInt() ?? 0,
    );
  }
}
