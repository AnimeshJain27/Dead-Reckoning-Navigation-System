// C++ IDR 26168 Log Replay CLI Harness
// Replays real phone sensor streams (IO-VNBD or own-logs) through libidr_core
// Evaluates dead reckoning accuracy against reference vehicle CAN / RTK ground truth.

#include <iostream>
#include <fstream>
#include <sstream>
#include <vector>
#include <string>
#include <cmath>
#include <iomanip>
#include <map>
#include <algorithm>
#include "idr/idr.h"
#include "geo/geodesic.hpp"

struct ReplayOptions {
  std::string s_csv;
  std::string v_csv;
  std::string speed_model;
  std::string noise_model;
  std::string map_db;
  std::string out_file;
  std::string metrics_json;
  std::string baseline{"idr"};
  double outage_start_s{-1.0};
  double outage_dur_s{0.0};
};

struct TruthPoint {
  double t_s{0.0};
  double lat{0.0};
  double lon{0.0};
  double alt_m{0.0};
  double speed_mps{0.0};
  double heading_deg{0.0};
  double w_rear_radps{0.0};
  bool valid{false};
};

static std::string trim(const std::string& str) {
  size_t first = str.find_first_not_of(" \t\r\n");
  if (first == std::string::npos) return "";
  size_t last = str.find_last_not_of(" \t\r\n");
  return str.substr(first, (last - first + 1));
}

static std::string to_lower(std::string s) {
  std::transform(s.begin(), s.end(), s.begin(), [](unsigned char c) { return std::tolower(c); });
  return s;
}

static std::vector<std::string> split_csv(const std::string& line) {
  std::vector<std::string> row;
  std::stringstream ss(line);
  std::string cell;
  while (std::getline(ss, cell, ',')) {
    row.push_back(trim(cell));
  }
  return row;
}

int main(int argc, char** argv) {
  ReplayOptions opts;
  for (int i = 1; i < argc; ++i) {
    std::string arg = argv[i];
    if (arg == "--s" && i + 1 < argc) opts.s_csv = argv[++i];
    else if (arg == "--v" && i + 1 < argc) opts.v_csv = argv[++i];
    else if (arg == "--speed-model" && i + 1 < argc) opts.speed_model = argv[++i];
    else if (arg == "--noise-model" && i + 1 < argc) opts.noise_model = argv[++i];
    else if (arg == "--map" && i + 1 < argc) opts.map_db = argv[++i];
    else if (arg == "--out" && i + 1 < argc) opts.out_file = argv[++i];
    else if (arg == "--metrics-json" && i + 1 < argc) opts.metrics_json = argv[++i];
    else if (arg == "--baseline" && i + 1 < argc) opts.baseline = argv[++i];
    else if (arg == "--outage-start" && i + 1 < argc) opts.outage_start_s = std::stod(argv[++i]);
    else if (arg == "--outage-dur" && i + 1 < argc) opts.outage_dur_s = std::stod(argv[++i]);
  }

  if (opts.s_csv.empty()) {
    std::cout << "IDR 26168 Replay CLI Harness\n";
    std::cout << "Usage: replay_cli --s <phone.csv> [--v <ref.csv>] [--speed-model <model.onnx>] "
              << "[--noise-model <adapter.onnx>] [--map <map.sqlite>] [--baseline <idr|ins|nhc|no_adapter|no_map|whonet>] "
              << "[--outage-start <sec>] [--outage-dur <sec>] [--metrics-json <out.json>] [--out <track.csv>]\n";
    return 0;
  }

  std::cout << "=== IDR 26168 Navigation Replay ===\n";
  std::cout << "Phone log:     " << opts.s_csv << "\n";
  if (!opts.v_csv.empty()) std::cout << "Ground truth:  " << opts.v_csv << "\n";
  std::cout << "Baseline Mode: " << opts.baseline << "\n";
  if (opts.outage_start_s >= 0.0) {
    std::cout << "Simulated Outage: [" << opts.outage_start_s << " s, "
              << (opts.outage_start_s + opts.outage_dur_s) << " s] ("
              << opts.outage_dur_s << " s duration)\n";
  }

  // Load ground truth points if provided
  std::vector<TruthPoint> truth_points;
  if (!opts.v_csv.empty()) {
    std::ifstream v_file(opts.v_csv);
    if (v_file.is_open()) {
      std::string header_line;
      if (std::getline(v_file, header_line)) {
        auto cols = split_csv(header_line);
        std::map<std::string, int> v_col_map;
        for (size_t i = 0; i < cols.size(); ++i) {
          v_col_map[to_lower(cols[i])] = static_cast<int>(i);
        }

        auto get_v_idx = [&](const std::string& name, int def) {
          auto it = v_col_map.find(to_lower(name));
          return (it != v_col_map.end()) ? it->second : def;
        };

        int idx_t = get_v_idx("t_s", 1);
        int idx_lat = get_v_idx("lat", 2);
        int idx_lon = get_v_idx("lon", 3);
        int idx_alt = get_v_idx("alt_m", 4);
        int idx_spd = get_v_idx("speed_mps", 5);
        int idx_hdg = get_v_idx("heading_deg", 6);
        int idx_w_rear = get_v_idx("w_rear_radps", 13);

        std::string row_str;
        while (std::getline(v_file, row_str)) {
          if (row_str.empty()) continue;
          auto r = split_csv(row_str);
          try {
            TruthPoint pt;
            if (idx_t >= 0 && idx_t < (int)r.size()) pt.t_s = std::stod(r[idx_t]);
            if (idx_lat >= 0 && idx_lat < (int)r.size()) pt.lat = std::stod(r[idx_lat]);
            if (idx_lon >= 0 && idx_lon < (int)r.size()) pt.lon = std::stod(r[idx_lon]);
            if (idx_alt >= 0 && idx_alt < (int)r.size()) pt.alt_m = std::stod(r[idx_alt]);
            if (idx_spd >= 0 && idx_spd < (int)r.size()) pt.speed_mps = std::stod(r[idx_spd]);
            if (idx_hdg >= 0 && idx_hdg < (int)r.size()) pt.heading_deg = std::stod(r[idx_hdg]);
            if (idx_w_rear >= 0 && idx_w_rear < (int)r.size()) pt.w_rear_radps = std::stod(r[idx_w_rear]);
            pt.valid = (std::abs(pt.lat) > 0.001 && std::abs(pt.lon) > 0.001);
            truth_points.push_back(pt);
          } catch (...) {}
        }
      }
      v_file.close();
      std::cout << "Loaded " << truth_points.size() << " ground truth points.\n";
    }
  }

  idr_config cfg{};
  cfg.imu_rate_hz = 10.0;
  cfg.alert_limit_m = 20.0;
  cfg.has_gyroscope = 1;

  if (opts.baseline == "ins") cfg.baseline_mode = IDR_BASELINE_INS_ONLY;
  else if (opts.baseline == "nhc") cfg.baseline_mode = IDR_BASELINE_NHC_ONLY;
  else if (opts.baseline == "no_adapter") cfg.baseline_mode = IDR_BASELINE_NO_ADAPTER;
  else if (opts.baseline == "no_map") cfg.baseline_mode = IDR_BASELINE_NO_MAP;
  else if (opts.baseline == "whonet") cfg.baseline_mode = IDR_BASELINE_WHONET;
  else cfg.baseline_mode = IDR_BASELINE_FULL;

  idr_engine* eng = idr_create(&cfg);
  if (!eng) {
    std::cerr << "Failed to create idr engine\n";
    return 1;
  }

  if (!opts.speed_model.empty() && !opts.noise_model.empty()) {
    if (idr_load_models(eng, opts.speed_model.c_str(), opts.noise_model.c_str()) == 0) {
      std::cout << "Loaded neural models: " << opts.speed_model << ", " << opts.noise_model << "\n";
    }
  }

  if (!opts.map_db.empty()) {
    if (idr_load_map(eng, opts.map_db.c_str(), nullptr) == 0) {
      std::cout << "Loaded map pack: " << opts.map_db << "\n";
    }
  }

  std::ifstream s_file(opts.s_csv);
  if (!s_file.is_open()) {
    std::cerr << "Failed to open phone file: " << opts.s_csv << "\n";
    idr_destroy(eng);
    return 1;
  }

  std::string header_line;
  if (!std::getline(s_file, header_line)) {
    std::cerr << "Empty phone file\n";
    idr_destroy(eng);
    return 1;
  }

  auto s_cols = split_csv(header_line);
  std::map<std::string, int> s_col_map;
  for (size_t i = 0; i < s_cols.size(); ++i) {
    s_col_map[to_lower(s_cols[i])] = static_cast<int>(i);
  }

  auto get_s_idx = [&](const std::string& name, int def) {
    auto it = s_col_map.find(to_lower(name));
    return (it != s_col_map.end()) ? it->second : def;
  };

  int idx_t_s = get_s_idx("t_s", 1);
  int idx_ax = get_s_idx("ax", 4);
  int idx_ay = get_s_idx("ay", 5);
  int idx_az = get_s_idx("az", 6);
  int idx_gz = get_s_idx("gz", 7);
  int idx_gy = get_s_idx("gy", 8);
  int idx_gx = get_s_idx("gx", 9);
  int idx_mx = get_s_idx("mx", 13);
  int idx_my = get_s_idx("my", 14);
  int idx_mz = get_s_idx("mz", 15);
  int idx_lat = get_s_idx("lat", 16);
  int idx_lon = get_s_idx("lon", 17);
  int idx_alt = get_s_idx("alt_m", 18);
  int idx_spd = get_s_idx("speed_mps", 19);
  int idx_r68 = get_s_idx("r68_m", 20);
  int idx_brg = get_s_idx("bearing_deg", 21);
  int idx_sat = get_s_idx("n_sats", 22);

  int64_t step_count = 0;
  int64_t fix_count = 0;
  double total_dist_m = 0.0;
  double last_lat = 0.0, last_lon = 0.0;

  // Outage evaluation metrics (Dossier §7.1)
  idr::geo::LocalTangentPlane ref_plane;
  bool ref_plane_init = false;

  int64_t outage_epochs = 0;
  double max_pos_err_m = 0.0;
  double end_pos_err_m = 0.0;
  double sum_pos_err_m = 0.0;
  double total_true_dist_outage_m = 0.0;
  double sum_along_m = 0.0;
  double sum_cross_m = 0.0;
  double max_along_m = 0.0;
  double max_cross_m = 0.0;
  int64_t hpl_exceedances = 0;
  idr::Vector3d p_est_outage_start = idr::Vector3d::Zero();
  idr::Vector3d p_ref_outage_start = idr::Vector3d::Zero();

  // 1-second distance accumulation for CRSE, CAE, AEPS
  std::vector<double> second_dr_dist;
  std::vector<double> second_truth_dist;
  double cur_sec_dr_dist = 0.0;
  double cur_sec_truth_dist = 0.0;
  int sec_sample_count = 0;

  std::ofstream out_stream;
  if (!opts.out_file.empty()) {
    out_stream.open(opts.out_file);
    out_stream << "t_s,lat,lon,speed_mps,hpl_m,mode,vehicle_mode,truth_lat,truth_lon,pos_err_m,along_err_m,cross_err_m\n";
  }

  std::string line;
  size_t truth_cursor = 0;

  while (std::getline(s_file, line)) {
    if (line.empty()) continue;
    auto row = split_csv(line);
    if (row.size() < 10) continue;

    try {
      double t_s = std::stod(row[idx_t_s]);
      int64_t t_ns = static_cast<int64_t>(t_s * 1e9);

      idr_imu imu{};
      imu.t_ns = t_ns;
      imu.ax = std::stod(row[idx_ax]);
      imu.ay = std::stod(row[idx_ay]);
      imu.az = std::stod(row[idx_az]);
      imu.gx = std::stod(row[idx_gx]);
      imu.gy = std::stod(row[idx_gy]);
      imu.gz = std::stod(row[idx_gz]);

      idr_push_imu(eng, &imu);

      if (idx_mx >= 0 && idx_mx < (int)row.size() && idx_my < (int)row.size() && idx_mz < (int)row.size()) {
        idr_mag mag{};
        mag.t_ns = t_ns;
        mag.mx = std::stod(row[idx_mx]);
        mag.my = std::stod(row[idx_my]);
        mag.mz = std::stod(row[idx_mz]);
        idr_push_mag(eng, &mag);
      }

      // Check simulated outage
      bool in_outage = (opts.outage_start_s >= 0.0 &&
                        t_s >= opts.outage_start_s &&
                        t_s < (opts.outage_start_s + opts.outage_dur_s));

      static double last_fix_lat = 0.0, last_fix_lon = 0.0;
      if (idx_lat >= 0 && idx_lat < (int)row.size() && !in_outage) {
        double lat = std::stod(row[idx_lat]);
        double lon = std::stod(row[idx_lon]);
        if (std::abs(lat) > 0.1 && std::abs(lon) > 0.1) {
          // Push fix only when a new fix arrives from the receiver (§3.4)
          if (std::abs(lat - last_fix_lat) > 1e-7 || std::abs(lon - last_fix_lon) > 1e-7) {
            last_fix_lat = lat;
            last_fix_lon = lon;
            idr_fix fix{};
            fix.t_ns = t_ns;
            fix.utc_ms = static_cast<int64_t>(t_s * 1000.0);
            fix.lat_deg = lat;
            fix.lon_deg = lon;
            fix.alt_m = (idx_alt >= 0 && idx_alt < (int)row.size()) ? std::stod(row[idx_alt]) : 10.0;
            fix.speed_mps = (idx_spd >= 0 && idx_spd < (int)row.size()) ? std::stod(row[idx_spd]) : 0.0;
            fix.bearing_deg = (idx_brg >= 0 && idx_brg < (int)row.size()) ? std::stod(row[idx_brg]) : 0.0;
            fix.r68_m = (idx_r68 >= 0 && idx_r68 < (int)row.size()) ? std::stod(row[idx_r68]) : 5.0;
            fix.num_sats = (idx_sat >= 0 && idx_sat < (int)row.size()) ? std::stoi(row[idx_sat]) : 8;
            fix.valid = 1;
            idr_push_fix(eng, &fix);
            fix_count++;
          }
        }
      }

      // Match ground truth point for current epoch
      TruthPoint cur_truth{};
      while (truth_cursor + 1 < truth_points.size() && truth_points[truth_cursor + 1].t_s <= t_s + 0.05) {
        truth_cursor++;
      }
      if (truth_cursor < truth_points.size()) {
        cur_truth = truth_points[truth_cursor];
      }

      if (opts.baseline == "whonet" && cur_truth.valid) {
        double wh_speed = (cur_truth.w_rear_radps > 0.0) ? (cur_truth.w_rear_radps * 0.288) : cur_truth.speed_mps;
        idr_push_wheel_speed(eng, wh_speed);
      }

      idr_step(eng, t_ns);
      step_count++;

      idr_state st{};
      idr_get_state(eng, &st);

      // Distance calculation
      if (last_lat != 0.0) {
        double dlat = (st.lat_deg - last_lat) * 111319.5;
        double dlon = (st.lon_deg - last_lon) * 111319.5 * std::cos(st.lat_deg * 0.0174532925);
        total_dist_m += std::sqrt(dlat*dlat + dlon*dlon);
      }
      last_lat = st.lat_deg;
      last_lon = st.lon_deg;

      // Outage evaluation against ground truth
      double cur_pos_err = 0.0;
      double along_err = 0.0;
      double cross_err = 0.0;

      if (cur_truth.valid) {
        if (!ref_plane_init) {
          ref_plane.reset(cur_truth.lat, cur_truth.lon, cur_truth.alt_m);
          ref_plane_init = true;
        }

        auto p_est_enu = ref_plane.forward(st.lat_deg, st.lon_deg, st.alt_m);
        auto p_ref_enu = ref_plane.forward(cur_truth.lat, cur_truth.lon, cur_truth.alt_m);

        double de = p_est_enu(0) - p_ref_enu(0);
        double dn = p_est_enu(1) - p_ref_enu(1);
        cur_pos_err = std::hypot(de, dn);

        // Heading unit vectors
        double psi_rad = (90.0 - cur_truth.heading_deg) * (3.141592653589793 / 180.0);
        double uf_e = std::cos(psi_rad);
        double uf_n = std::sin(psi_rad);
        double uc_e = -uf_n;
        double uc_n = uf_e;

        along_err = de * uf_e + dn * uf_n;
        cross_err = de * uc_e + dn * uc_n;

        if (in_outage) {
          if (outage_epochs == 0) {
            p_est_outage_start = p_est_enu;
            p_ref_outage_start = p_ref_enu;
          }
          outage_epochs++;

          // Outage relative displacement error (§7.1)
          double de_rel = (p_est_enu(0) - p_est_outage_start(0)) - (p_ref_enu(0) - p_ref_outage_start(0));
          double dn_rel = (p_est_enu(1) - p_est_outage_start(1)) - (p_ref_enu(1) - p_ref_outage_start(1));
          double rel_err = std::hypot(de_rel, dn_rel);

          double along_rel = de_rel * uf_e + dn_rel * uf_n;
          double cross_rel = de_rel * uc_e + dn_rel * uc_n;

          sum_pos_err_m += rel_err;
          max_pos_err_m = std::max(max_pos_err_m, rel_err);
          end_pos_err_m = rel_err;

          sum_along_m += std::abs(along_rel);
          sum_cross_m += std::abs(cross_rel);
          max_along_m = std::max(max_along_m, std::abs(along_rel));
          max_cross_m = std::max(max_cross_m, std::abs(cross_rel));

          total_true_dist_outage_m += cur_truth.speed_mps * 0.1;

          if (rel_err > st.hpl_m) {
            hpl_exceedances++;
          }

          cur_sec_dr_dist += st.speed_mps * 0.1;
          cur_sec_truth_dist += cur_truth.speed_mps * 0.1;
          sec_sample_count++;

          if (sec_sample_count >= 10) {
            second_dr_dist.push_back(cur_sec_dr_dist);
            second_truth_dist.push_back(cur_sec_truth_dist);
            cur_sec_dr_dist = 0.0;
            cur_sec_truth_dist = 0.0;
            sec_sample_count = 0;
          }
        }
      }

      if (out_stream.is_open()) {
        out_stream << std::fixed << std::setprecision(6)
                   << t_s << "," << st.lat_deg << "," << st.lon_deg << ","
                   << st.speed_mps << "," << st.hpl_m << ","
                   << st.mode << "," << st.vehicle_mode << ","
                   << cur_truth.lat << "," << cur_truth.lon << ","
                   << cur_pos_err << "," << along_err << "," << cross_err << "\n";
      }

      // Early termination if evaluating simulated outage window
      if (opts.outage_start_s >= 0.0 && t_s >= (opts.outage_start_s + opts.outage_dur_s + 0.05)) {
        break;
      }

    } catch (...) {}
  }

  s_file.close();
  if (out_stream.is_open()) out_stream.close();

  // Residual second in outage if any
  if (sec_sample_count > 0) {
    second_dr_dist.push_back(cur_sec_dr_dist);
    second_truth_dist.push_back(cur_sec_truth_dist);
  }

  // Compute CRSE, CAE, AEPS (Onyekpe et al., Dossier §7.1)
  double crse = 0.0;
  double cae_sum = 0.0;
  size_t n_sec = second_dr_dist.size();
  for (size_t k = 0; k < n_sec; ++k) {
    double e_t = second_dr_dist[k] - second_truth_dist[k];
    crse += std::abs(e_t);
    cae_sum += e_t;
  }
  double cae = std::abs(cae_sum);
  double aeps = (n_sec > 0) ? (cae / static_cast<double>(n_sec)) : 0.0;

  double drift_pct = (total_true_dist_outage_m > 0.0)
                     ? ((max_pos_err_m / total_true_dist_outage_m) * 100.0)
                     : 0.0;

  double mean_along = (outage_epochs > 0) ? (sum_along_m / outage_epochs) : 0.0;
  double mean_cross = (outage_epochs > 0) ? (sum_cross_m / outage_epochs) : 0.0;
  double mean_pos_err = (outage_epochs > 0) ? (sum_pos_err_m / outage_epochs) : 0.0;

  std::cout << "\n=== Replay Finished ===\n";
  std::cout << "Total epochs processed: " << step_count << "\n";
  std::cout << "Total GNSS fixes:       " << fix_count << "\n";
  std::cout << "Total path length:      " << std::fixed << std::setprecision(1) << total_dist_m << " m\n";

  if (opts.outage_start_s >= 0.0 && outage_epochs > 0) {
    std::cout << "\n=== Outage Benchmark Results (" << opts.outage_dur_s << " s) ===\n";
    std::cout << "CRSE (Cumulative Root Squared Error): " << std::setprecision(3) << crse << " m\n";
    std::cout << "CAE (Cumulative Absolute Error):      " << std::setprecision(3) << cae << " m\n";
    std::cout << "AEPS (Absolute Error Per Second):     " << std::setprecision(4) << aeps << " m/s\n";
    std::cout << "2D Drift %:                           " << std::setprecision(2) << drift_pct << " %\n";
    std::cout << "End-Point Error (EPE):                " << std::setprecision(2) << end_pos_err_m << " m\n";
    std::cout << "Max 2D Error:                         " << std::setprecision(2) << max_pos_err_m << " m\n";
    std::cout << "Mean 2D Error:                        " << std::setprecision(2) << mean_pos_err << " m\n";
    std::cout << "Mean Along-Track Error:               " << std::setprecision(2) << mean_along << " m (max: " << max_along_m << " m)\n";
    std::cout << "Mean Cross-Track Error:               " << std::setprecision(2) << mean_cross << " m (max: " << max_cross_m << " m)\n";
    std::cout << "Outage Distance Covered:              " << std::setprecision(1) << total_true_dist_outage_m << " m\n";
    std::cout << "HPL Exceedance Epochs:                " << hpl_exceedances << " / " << outage_epochs << "\n";
  }

  // Write JSON metrics if requested
  if (!opts.metrics_json.empty()) {
    std::ofstream mj(opts.metrics_json);
    if (mj.is_open()) {
      mj << "{\n"
         << "  \"baseline\": \"" << opts.baseline << "\",\n"
         << "  \"outage_start_s\": " << opts.outage_start_s << ",\n"
         << "  \"outage_dur_s\": " << opts.outage_dur_s << ",\n"
         << "  \"outage_epochs\": " << outage_epochs << ",\n"
         << "  \"distance_m\": " << total_true_dist_outage_m << ",\n"
         << "  \"crse_m\": " << crse << ",\n"
         << "  \"cae_m\": " << cae << ",\n"
         << "  \"aeps_mps\": " << aeps << ",\n"
         << "  \"drift_pct\": " << drift_pct << ",\n"
         << "  \"epe_m\": " << end_pos_err_m << ",\n"
         << "  \"max_pos_err_m\": " << max_pos_err_m << ",\n"
         << "  \"mean_pos_err_m\": " << mean_pos_err << ",\n"
         << "  \"mean_along_track_m\": " << mean_along << ",\n"
         << "  \"max_along_track_m\": " << max_along_m << ",\n"
         << "  \"mean_cross_track_m\": " << mean_cross << ",\n"
         << "  \"max_cross_track_m\": " << max_cross_m << ",\n"
         << "  \"hpl_exceedances\": " << hpl_exceedances << "\n"
         << "}\n";
      mj.close();
    }
  }

  idr_destroy(eng);
  return 0;
}
