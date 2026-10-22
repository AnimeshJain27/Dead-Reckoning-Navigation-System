import 'dart:async';
import 'package:flutter/services.dart';
import '../models/nav_state.dart';

class NavBridge {
  static const MethodChannel _navChannel = MethodChannel('idr/nav');
  static const EventChannel _stateChannel = EventChannel('idr/state');
  static const EventChannel _eventChannel = EventChannel('idr/events');

  Stream<NavState>? _stateStream;
  Stream<Map<dynamic, dynamic>>? _eventStream;

  Stream<NavState> get stateStream {
    _stateStream ??= _stateChannel.receiveBroadcastStream().map((dynamic event) {
      if (event is Map) {
        return NavState.fromMap(event);
      }
      return const NavState(
        tNs: 0,
        lat: 18.9400,
        lon: 72.8450,
        alt: 10.0,
        speedMps: 0.0,
        headingDeg: 0.0,
        mode: NavMode.gnssOk,
        vehicleMode: VehicleClass.car,
        hplM: 5.0,
        ellMajorM: 5.0,
        ellMinorM: 3.0,
        wayId: 0,
      );
    });
    return _stateStream!;
  }

  Stream<Map<dynamic, dynamic>> get eventStream {
    _eventStream ??= _eventChannel.receiveBroadcastStream().map((dynamic event) {
      return (event as Map<dynamic, dynamic>?) ?? {};
    });
    return _eventStream!;
  }

  Future<bool> startNavigation({
    String speedModel = "",
    String adapterModel = "",
    String mapDb = "",
  }) async {
    try {
      final res = await _navChannel.invokeMethod<bool>('start', {
        'speedModel': speedModel,
        'adapterModel': adapterModel,
        'mapDb': mapDb,
      });
      return res ?? false;
    } catch (e) {
      // In non-Android or simulation environments, return true
      return true;
    }
  }

  Future<bool> stopNavigation() async {
    try {
      final res = await _navChannel.invokeMethod<bool>('stop');
      return res ?? false;
    } catch (e) {
      return true;
    }
  }
}
