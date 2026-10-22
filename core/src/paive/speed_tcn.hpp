// §2.1 & §3.2 P-AIVE Speed TCN Inference Runner
#ifndef IDR_PAIVE_SPEED_TCN_HPP
#define IDR_PAIVE_SPEED_TCN_HPP

#include "common/types.hpp"
#include <vector>
#include <string>
#include <cmath>
#include <deque>

#if __has_include(<onnxruntime_cxx_api.h>)
#include <onnxruntime_cxx_api.h>
#define IDR_HAS_ORT 1
#endif

namespace idr::paive {

struct SpeedOutput {
  double mu_mps{0.0};       // Estimated forward speed (m/s)
  double sigma_mps{0.2};    // Speed standard deviation (m/s)
  double var_mps2{0.04};    // Variance (sigma^2)
};

class SpeedTcnRunner {
public:
  SpeedTcnRunner() = default;

  bool load_model(const std::string& onnx_path) {
#if IDR_HAS_ORT
    try {
      env_ = std::make_unique<Ort::Env>(ORT_LOGGING_LEVEL_WARNING, "SpeedTCN");
      Ort::SessionOptions options;
      options.SetIntraOpNumThreads(1);
      options.SetGraphOptimizationLevel(GraphOptimizationLevel::ORT_ENABLE_ALL);

#if defined(_WIN32)
      std::wstring wpath(onnx_path.begin(), onnx_path.end());
      session_ = std::make_unique<Ort::Session>(*env_, wpath.c_str(), options);
#else
      session_ = std::make_unique<Ort::Session>(*env_, onnx_path.c_str(), options);
#endif
      is_loaded_ = true;
      return true;
    } catch (...) {
      is_loaded_ = false;
      return false;
    }
#else
    (void)onnx_path;
    return false;
#endif
  }

  // Push vehicle-frame low-passed f^v and omega^v (6 channels)
  void push_features(const Vector3d& f_v, const Vector3d& omega_v) {
    std::array<float, 6> sample = {
      static_cast<float>(f_v(0)), static_cast<float>(f_v(1)), static_cast<float>(f_v(2)),
      static_cast<float>(omega_v(0)), static_cast<float>(omega_v(1)), static_cast<float>(omega_v(2))
    };
    feature_window_.push_back(sample);
    if (feature_window_.size() > 30) {
      feature_window_.pop_front();
    }
  }

  // Run 10 Hz inference over 30-sample sliding window
  SpeedOutput predict(double fallback_speed = 0.0) {
    SpeedOutput out;
    if (feature_window_.size() < 10) {
      out.mu_mps = fallback_speed;
      out.sigma_mps = 0.5;
      out.var_mps2 = 0.25;
      return out;
    }

#if IDR_HAS_ORT
    if (is_loaded_ && session_) {
      try {
        // Flatten window 1 x 6 x 30
        std::vector<float> input_tensor(1 * 6 * 30, 0.0f);
        size_t n = feature_window_.size();
        size_t offset = 30 - n;
        for (size_t t = 0; t < n; ++t) {
          for (size_t c = 0; c < 6; ++c) {
            input_tensor[c * 30 + (offset + t)] = feature_window_[t][c];
          }
        }

        std::array<int64_t, 3> input_shape = {1, 6, 30};
        Ort::MemoryInfo mem_info = Ort::MemoryInfo::CreateCpu(OrtArenaAllocator, OrtMemTypeDefault);
        Ort::Value input_val = Ort::Value::CreateTensor<float>(
            mem_info, input_tensor.data(), input_tensor.size(), input_shape.data(), input_shape.size());

        const char* input_names[] = {"input"};
        const char* output_names[] = {"output"};

        auto output_tensors = session_->Run(
            Ort::RunOptions{nullptr}, input_names, &input_val, 1, output_names, 1);

        float* out_data = output_tensors.front().GetTensorMutableData<float>();
        float z_mu = out_data[0];
        float z_logvar = out_data[1];

        // mu = softplus(z_mu) = log(1 + exp(z_mu))
        double mu = (z_mu > 20.0f) ? z_mu : std::log1p(std::exp(z_mu));

        // Clip log sigma^2 to [log 0.05^2, log 5^2] = [-5.99, 3.22]
        double log_var = std::clamp(static_cast<double>(z_logvar), -5.9914, 3.2188);
        double var = std::exp(log_var);

        out.mu_mps = mu;
        out.var_mps2 = var;
        out.sigma_mps = std::sqrt(var);
        return out;
      } catch (...) {
        // Fallback to kinematic integration on inference failure
      }
    }
#endif

    // Kinematic baseline fallback when ONNX model is uninitialized
    // Estimate speed from centrifugal relation: v = a_lat / yaw_rate or integration
    double f_lat = feature_window_.back()[1];
    double yaw_rate = feature_window_.back()[5];
    if (std::abs(yaw_rate) > 0.05) {
      double v_centripetal = std::abs(f_lat / yaw_rate);
      out.mu_mps = std::clamp(v_centripetal, 0.0, 40.0);
    } else {
      out.mu_mps = fallback_speed;
    }
    out.sigma_mps = 0.4;
    out.var_mps2 = 0.16;
    return out;
  }

  bool is_loaded() const { return is_loaded_; }

private:
  bool is_loaded_{false};
  std::deque<std::array<float, 6>> feature_window_;

#if IDR_HAS_ORT
  std::unique_ptr<Ort::Env> env_;
  std::unique_ptr<Ort::Session> session_;
#endif
};

} // namespace idr::paive

#endif // IDR_PAIVE_SPEED_TCN_HPP
