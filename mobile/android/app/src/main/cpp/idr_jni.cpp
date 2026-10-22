// Android NDK JNI Bridge for IDR 26168 Core Engine
#include <jni.h>
#include <string>
#include <vector>
#include "idr/idr.h"

extern "C" {

JNIEXPORT jlong JNICALL
Java_com_idr_nav_NavService_nativeCreate(JNIEnv* env, jobject /*thiz*/,
                                         jdouble imuRateHz, jdouble alertLimitM,
                                         jboolean hasGyro, jboolean hasBaro) {
  idr_config cfg{};
  cfg.imu_rate_hz = imuRateHz;
  cfg.alert_limit_m = alertLimitM;
  cfg.has_gyroscope = hasGyro ? 1 : 0;
  cfg.has_barometer = hasBaro ? 1 : 0;
  cfg.sigma_accel_noise = 0.05;
  cfg.sigma_gyro_noise = 0.05;

  idr_engine* eng = idr_create(&cfg);
  return reinterpret_cast<jlong>(eng);
}

JNIEXPORT void JNICALL
Java_com_idr_nav_NavService_nativeDestroy(JNIEnv* env, jobject /*thiz*/, jlong handle) {
  idr_engine* eng = reinterpret_cast<idr_engine*>(handle);
  if (eng) {
    idr_destroy(eng);
  }
}

JNIEXPORT jboolean JNICALL
Java_com_idr_nav_NavService_nativeLoadModels(JNIEnv* env, jobject /*thiz*/, jlong handle,
                                             jstring speedPath, jstring adapterPath) {
  idr_engine* eng = reinterpret_cast<idr_engine*>(handle);
  if (!eng) return JNI_FALSE;

  const char* s_path = env->GetStringUTFChars(speedPath, nullptr);
  const char* a_path = env->GetStringUTFChars(adapterPath, nullptr);

  int rc = idr_load_models(eng, s_path, a_path);

  env->ReleaseStringUTFChars(speedPath, s_path);
  env->ReleaseStringUTFChars(adapterPath, a_path);
  return (rc == 0) ? JNI_TRUE : JNI_FALSE;
}

JNIEXPORT jboolean JNICALL
Java_com_idr_nav_NavService_nativeLoadMap(JNIEnv* env, jobject /*thiz*/, jlong handle,
                                          jstring mapPath, jstring userPath) {
  idr_engine* eng = reinterpret_cast<idr_engine*>(handle);
  if (!eng) return JNI_FALSE;

  const char* m_path = env->GetStringUTFChars(mapPath, nullptr);
  const char* u_path = userPath ? env->GetStringUTFChars(userPath, nullptr) : nullptr;

  int rc = idr_load_map(eng, m_path, u_path);

  env->ReleaseStringUTFChars(mapPath, m_path);
  if (u_path) env->ReleaseStringUTFChars(userPath, u_path);
  return (rc == 0) ? JNI_TRUE : JNI_FALSE;
}

JNIEXPORT void JNICALL
Java_com_idr_nav_NavService_nativePushImu(JNIEnv* env, jobject /*thiz*/, jlong handle,
                                         jlong tNs, jdouble ax, jdouble ay, jdouble az,
                                         jdouble gx, jdouble gy, jdouble gz) {
  idr_engine* eng = reinterpret_cast<idr_engine*>(handle);
  if (!eng) return;

  idr_imu imu{};
  imu.t_ns = tNs;
  imu.ax = ax;
  imu.ay = ay;
  imu.az = az;
  imu.gx = gx;
  imu.gy = gy;
  imu.gz = gz;
  idr_push_imu(eng, &imu);
}

JNIEXPORT void JNICALL
Java_com_idr_nav_NavService_nativePushMag(JNIEnv* env, jobject /*thiz*/, jlong handle,
                                         jlong tNs, jdouble mx, jdouble my, jdouble mz) {
  idr_engine* eng = reinterpret_cast<idr_engine*>(handle);
  if (!eng) return;

  idr_mag mag{};
  mag.t_ns = tNs;
  mag.mx = mx;
  mag.my = my;
  mag.mz = mz;
  idr_push_mag(eng, &mag);
}

JNIEXPORT void JNICALL
Java_com_idr_nav_NavService_nativePushFix(JNIEnv* env, jobject /*thiz*/, jlong handle,
                                         jlong tNs, jdouble lat, jdouble lon, jdouble alt,
                                         jdouble speed, jdouble bearing, jdouble r68,
                                         jint numSats, jboolean valid) {
  idr_engine* eng = reinterpret_cast<idr_engine*>(handle);
  if (!eng) return;

  idr_fix fix{};
  fix.t_ns = tNs;
  fix.lat_deg = lat;
  fix.lon_deg = lon;
  fix.alt_m = alt;
  fix.speed_mps = speed;
  fix.bearing_deg = bearing;
  fix.r68_m = r68;
  fix.num_sats = numSats;
  fix.valid = valid ? 1 : 0;
  idr_push_fix(eng, &fix);
}

JNIEXPORT void JNICALL
Java_com_idr_nav_NavService_nativeStep(JNIEnv* env, jobject /*thiz*/, jlong handle, jlong nowNs) {
  idr_engine* eng = reinterpret_cast<idr_engine*>(handle);
  if (eng) {
    idr_step(eng, nowNs);
  }
}

JNIEXPORT jboolean JNICALL
Java_com_idr_nav_NavService_nativeGetState(JNIEnv* env, jobject /*thiz*/, jlong handle, jdoubleArray outArray) {
  idr_engine* eng = reinterpret_cast<idr_engine*>(handle);
  if (!eng) return JNI_FALSE;

  idr_state st{};
  int rc = idr_get_state(eng, &st);
  if (rc != 0) return JNI_FALSE;

  jdouble buf[12];
  buf[0] = static_cast<jdouble>(st.t_ns);
  buf[1] = st.lat_deg;
  buf[2] = st.lon_deg;
  buf[3] = st.alt_m;
  buf[4] = st.speed_mps;
  buf[5] = st.heading_deg;
  buf[6] = static_cast<jdouble>(st.mode);
  buf[7] = static_cast<jdouble>(st.vehicle_mode);
  buf[8] = st.hpl_m;
  buf[9] = st.ell_major_m;
  buf[10] = st.ell_minor_m;
  buf[11] = static_cast<jdouble>(st.matched_way_id);

  env->SetDoubleArrayRegion(outArray, 0, 12, buf);
  return JNI_TRUE;
}

} // extern "C"
