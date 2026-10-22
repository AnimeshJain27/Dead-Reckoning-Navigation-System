"""Train Noise Adapter on vibration envelopes and dynamics.

Implements Stage 2 noise scaling from DOSSIER rev69 §2.1 & §4.2:
- Input: [f^v (3), omega^v (3), ell_fz (1), ell_fy (1), ell_omega_x (1), mu (1)] = 10 channels over 30 steps
- Output: 5 scaling factors for R_NHC, R_speed, Q_a, Q_omega
- Saved to models/noise_adapter.pt
"""

import json
from pathlib import Path
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader

from idr_ml.models.noise_adapter import NoiseAdapter


class NoiseAdapterDataset(Dataset):
    """Dataset extracting 10-channel vibration and dynamics features."""

    def __init__(self, session_ids: list[str], data_dir: str = "data/interim/io-vnbd",
                 window_size: int = 30, max_samples: int = 5000):
        self.samples = []
        self.targets = []

        for sess_id in session_ids:
            s_path = Path(data_dir) / "S" / f"{sess_id}.parquet"
            v_path = Path(data_dir) / "V" / f"{sess_id}.parquet"
            if not s_path.exists() or not v_path.exists():
                continue

            df_s = pd.read_parquet(s_path)
            df_v = pd.read_parquet(v_path)
            n = min(len(df_s), len(df_v))
            if n < window_size + 30:
                continue

            ax = df_s["ax"].iloc[:n].to_numpy(dtype=np.float32)
            ay = df_s["ay"].iloc[:n].to_numpy(dtype=np.float32)
            az = df_s["az"].iloc[:n].to_numpy(dtype=np.float32)
            gx = df_s["gx"].iloc[:n].to_numpy(dtype=np.float32)
            gy = df_s["gy"].iloc[:n].to_numpy(dtype=np.float32)
            gz = df_s["gz"].iloc[:n].to_numpy(dtype=np.float32)
            spd = df_v["speed_mps"].iloc[:n].to_numpy(dtype=np.float32)

            # Vibration envelopes: high-pass residual log RMS over 10 samples (1 s) (§2.1)
            # High-pass residual via moving average subtraction
            def log_env(sig):
                ma = np.convolve(sig, np.ones(5)/5.0, mode="same")
                diff = sig - ma
                rms = np.sqrt(np.convolve(diff**2, np.ones(10)/10.0, mode="same") + 1e-6)
                return np.log10(np.clip(rms, 1e-4, 50.0)).astype(np.float32)

            ell_fz = log_env(az)
            ell_fy = log_env(ay)
            ell_wx = log_env(gx)

            # Target scaling baseline: higher vibration and speed increases observation variance
            vib_intensity = (np.clip(ell_fz + 1.0, 0.1, 4.0) +
                             np.clip(ell_fy + 1.0, 0.1, 4.0)) * 0.5

            stride = max(1, (n - window_size) // max_samples)
            for i in range(0, n - window_size, stride):
                w_feats = np.stack([
                    ax[i:i+window_size],
                    ay[i:i+window_size],
                    az[i:i+window_size],
                    gx[i:i+window_size],
                    gy[i:i+window_size],
                    gz[i:i+window_size],
                    ell_fz[i:i+window_size],
                    ell_fy[i:i+window_size],
                    ell_wx[i:i+window_size],
                    spd[i:i+window_size],
                ], axis=0)  # [10, 30]

                target_alpha = np.array([
                    vib_intensity[i + window_size - 1],       # alpha_nhc_lat
                    vib_intensity[i + window_size - 1] * 1.2, # alpha_nhc_up
                    vib_intensity[i + window_size - 1] * 0.8, # alpha_speed
                    vib_intensity[i + window_size - 1],       # alpha_Qa
                    vib_intensity[i + window_size - 1],       # alpha_Qomega
                ], dtype=np.float32)

                self.samples.append(w_feats)
                self.targets.append(target_alpha)

        self.samples = np.array(self.samples, dtype=np.float32)
        self.targets = np.array(self.targets, dtype=np.float32)

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        return torch.from_numpy(self.samples[idx]), torch.from_numpy(self.targets[idx])


def train_noise_adapter(splits_path: str = "data/processed/splits.json",
                        output_pt: str = "models/noise_adapter.pt",
                        epochs: int = 8,
                        batch_size: int = 64,
                        lr: float = 1e-3):
    """Train Noise Adapter model."""
    with open(splits_path, "r") as f:
        splits = json.load(f)

    train_dataset = NoiseAdapterDataset(splits["train"], max_samples=1500)
    val_dataset = NoiseAdapterDataset(splits["val"], max_samples=500)

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)

    model = NoiseAdapter()
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    loss_fn = nn.MSELoss()

    Path(output_pt).parent.mkdir(parents=True, exist_ok=True)
    best_loss = float("inf")

    for epoch in range(1, epochs + 1):
        model.train()
        train_loss = 0.0
        for x, y in train_loader:
            optimizer.zero_grad()
            z = model(x)
            alphas = NoiseAdapter.decode_alphas(z)
            loss = loss_fn(alphas, y)
            loss.backward()
            optimizer.step()
            train_loss += loss.item() * len(x)
        train_loss /= len(train_dataset)

        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for x, y in val_loader:
                z = model(x)
                alphas = NoiseAdapter.decode_alphas(z)
                val_loss += loss_fn(alphas, y).item() * len(x)
        val_loss /= len(val_dataset)

        print(f"Epoch {epoch:02d}/{epochs:02d} | Train MSE: {train_loss:.4f} | Val MSE: {val_loss:.4f}")

        if val_loss < best_loss:
            best_loss = val_loss
            torch.save({
                "model_state_dict": model.state_dict(),
                "val_mse": float(val_loss),
                "epoch": epoch
            }, output_pt)

    print(f"Noise Adapter training complete! Saved to {output_pt}.")
    return model


if __name__ == "__main__":
    train_noise_adapter()
