"""Yaw-rate cross-correlation synchronization between Smartphone (S) and Vehicle (V) logs.

Implements DOSSIER §7.1 formulas:
- Phone vertical yaw rate projection: s_S(t) = (omega_S . g_S) / ||g_S||
- CAN yaw rate: s_V(t) = yaw_rate_radps
- Normalized cross-correlation R(tau) with parabolic sub-sample peak interpolation
- 120 s window lag estimation and robust Huber linear fit tau(t) = tau_0 + eps * t
"""

import numpy as np
from scipy import signal
from scipy.interpolate import interp1d
from scipy.optimize import least_squares


def compute_phone_yaw_projection(gx: np.ndarray, gy: np.ndarray, gz: np.ndarray,
                                 grav_x: np.ndarray, grav_y: np.ndarray, grav_z: np.ndarray) -> np.ndarray:
    """Project 3-axis gyro onto gravity vector to get mount-independent yaw rate."""
    omega = np.column_stack([gx, gy, gz])
    g = np.column_stack([grav_x, grav_y, grav_z])
    g_norm = np.linalg.norm(g, axis=1, keepdims=True)
    g_norm = np.where(g_norm < 1e-3, 9.80665, g_norm)
    g_unit = g / g_norm
    s_s = np.sum(omega * g_unit, axis=1)
    return s_s


def estimate_lag_window(s_s: np.ndarray, s_v: np.ndarray, dt_s: float = 0.1, max_lag_s: float = 10.0) -> float:
    """Estimate fractional lag tau* (seconds) between s_S and s_V using cross-correlation."""
    n = min(len(s_s), len(s_v))
    if n < 30:
        return 0.0

    s1 = s_s[:n] - np.mean(s_s[:n])
    s2 = s_v[:n] - np.mean(s_v[:n])

    std1 = np.std(s1)
    std2 = np.std(s2)
    if std1 < 1e-4 or std2 < 1e-4:
        return 0.0

    max_lag_samples = int(max_lag_s / dt_s)
    corr = signal.correlate(s2, s1, mode="full") / (n * std1 * std2)
    lags = signal.correlation_lags(len(s2), len(s1), mode="full")

    # Constrain to [-max_lag, +max_lag]
    mask = (lags >= -max_lag_samples) & (lags <= max_lag_samples)
    corr_window = corr[mask]
    lags_window = lags[mask]

    peak_idx = np.argmax(np.abs(corr_window))
    hat_tau_samples = lags_window[peak_idx]

    # Parabolic sub-sample interpolation (§7.1)
    if 0 < peak_idx < len(corr_window) - 1:
        r_prev = corr_window[peak_idx - 1]
        r_peak = corr_window[peak_idx]
        r_next = corr_window[peak_idx + 1]
        denom = r_prev - 2.0 * r_peak + r_next
        if abs(denom) > 1e-6:
            delta = (dt_s / 2.0) * ((r_prev - r_next) / denom)
            tau_star = hat_tau_samples * dt_s + delta
            return float(tau_star)

    return float(hat_tau_samples * dt_s)


def sync_session_pairs(df_s, df_v, dt_s: float = 0.1, window_len_s: float = 120.0):
    """Estimate drift tau(t) = tau_0 + eps * t in 120 s windows and align df_s to df_v."""
    # Ensure both dataframes have phone yaw projection
    if "grav_x" in df_s.columns and "gx" in df_s.columns:
        s_s = compute_phone_yaw_projection(
            df_s["gx"].to_numpy(), df_s["gy"].to_numpy(), df_s["gz"].to_numpy(),
            df_s["grav_x"].to_numpy(), df_s["grav_y"].to_numpy(), df_s["grav_z"].to_numpy()
        )
    elif "gz" in df_s.columns:
        s_s = df_s["gz"].to_numpy()
    else:
        return df_s, df_v, 0.0

    s_v = df_v["yaw_rate_radps"].to_numpy() if "yaw_rate_radps" in df_v.columns else np.zeros_like(s_s)

    # Estimate overall lag
    tau_global = estimate_lag_window(s_s, s_v, dt_s=dt_s, max_lag_s=15.0)

    # Sliding 120s window lags
    window_samples = int(window_len_s / dt_s)
    step_samples = window_samples // 2

    t_centers = []
    lags = []
    n_total = min(len(s_s), len(s_v))

    for start in range(0, n_total - window_samples + 1, step_samples):
        end = start + window_samples
        w_s = s_s[start:end]
        w_v = s_v[start:end]
        lag = estimate_lag_window(w_s, w_v, dt_s=dt_s, max_lag_s=5.0)
        t_center = (start + end) * 0.5 * dt_s
        t_centers.append(t_center)
        lags.append(lag)

    if len(lags) >= 3:
        try:
            X = np.array(t_centers)
            y = np.array(lags)
            def huber_res(p):
                return (p[0] + p[1] * X) - y
            res = least_squares(huber_res, [tau_global, 0.0], loss="huber")
            p_fit = res.x
            # Apply time shift: t_s_aligned = t_s - tau(t)
            time_shift = p_fit[0] + p_fit[1] * df_s["t_s"].to_numpy()
        except Exception:
            time_shift = np.full(len(df_s), tau_global)
    else:
        time_shift = np.full(len(df_s), tau_global)

    df_s_aligned = df_s.copy()
    df_s_aligned["t_s"] = df_s_aligned["t_s"] - time_shift

    return df_s_aligned, df_v, float(tau_global)
