"""Train Speed TCN on IO-VNBD rear wheel speed labels.

Implements Stage 1 training from DOSSIER rev69 §2.1 & §4.2:
- Supervised by undriven rear-wheel speeds and VBOX reference speed
- Loss: beta-NLL (beta=0.5) + acceleration limits + jerk limits + consistency
- Checkpoint saved to models/speed_tcn.pt
"""

import json
from pathlib import Path
import numpy as np
import pandas as pd
import torch
from torch.utils.data import Dataset, DataLoader

from idr_ml.models.speed_tcn import SpeedTCN
from idr_ml.train.loss import KinematicConsistencyLoss


class SpeedTCNDataset(Dataset):
    """Sliding window dataset of IMU 6-channel features and speed ground truth."""

    def __init__(self, session_ids: list[str], data_dir: str = "data/interim/io-vnbd",
                 window_size: int = 30, max_samples_per_session: int = 5000):
        self.samples = []
        self.targets = []
        self.window_size = window_size

        for sess_id in session_ids:
            s_path = Path(data_dir) / "S" / f"{sess_id}.parquet"
            v_path = Path(data_dir) / "V" / f"{sess_id}.parquet"
            if not s_path.exists() or not v_path.exists():
                continue

            df_s = pd.read_parquet(s_path)
            df_v = pd.read_parquet(v_path)

            n = min(len(df_s), len(df_v))
            if n < window_size + 10:
                continue

            # Standard 6 IMU features: [ax, ay, az, gx, gy, gz]
            feat_cols = ["ax", "ay", "az", "gx", "gy", "gz"]
            missing = [c for c in feat_cols if c not in df_s.columns]
            if missing:
                continue

            feats = df_s[feat_cols].iloc[:n].to_numpy(dtype=np.float32)

            # Ground truth speed: use V speed_mps
            speeds = df_v["speed_mps"].iloc[:n].to_numpy(dtype=np.float32)

            # If brake flag or ABS lockup, drop sample (§2.1)
            brake_mask = np.zeros(n, dtype=bool)
            if "brake_psi" in df_v.columns:
                brake_mask = df_v["brake_psi"].iloc[:n].to_numpy() > 200.0

            # Subsample stride to keep training snappy and diverse
            stride = max(1, (n - window_size) // max_samples_per_session)
            for i in range(0, n - window_size, stride):
                idx_end = i + window_size
                if brake_mask[idx_end - 1]:
                    continue

                w = feats[i:idx_end].T  # [6, 30]
                target_v = speeds[idx_end - 1]
                if target_v >= 0.0:
                    self.samples.append(w)
                    self.targets.append(target_v)

        self.samples = np.array(self.samples, dtype=np.float32)
        self.targets = np.array(self.targets, dtype=np.float32).reshape(-1, 1)

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        return torch.from_numpy(self.samples[idx]), torch.from_numpy(self.targets[idx])


def train_speed_tcn(splits_path: str = "data/processed/splits.json",
                    output_pt: str = "models/speed_tcn.pt",
                    epochs: int = 10,
                    batch_size: int = 64,
                    lr: float = 1e-3):
    """Train Speed TCN model and fit validation calibration kappa."""
    with open(splits_path, "r") as f:
        splits = json.load(f)

    print(f"Loading datasets for {len(splits['train'])} train and {len(splits['val'])} val sessions...")
    train_dataset = SpeedTCNDataset(splits["train"], max_samples_per_session=2000)
    val_dataset = SpeedTCNDataset(splits["val"], max_samples_per_session=1000)

    print(f"Dataset ready: {len(train_dataset)} train samples, {len(val_dataset)} val samples.")

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)

    model = SpeedTCN()
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    loss_fn = KinematicConsistencyLoss()

    best_val_rmse = float("inf")
    Path(output_pt).parent.mkdir(parents=True, exist_ok=True)

    for epoch in range(1, epochs + 1):
        model.train()
        train_loss = 0.0
        for x, y in train_loader:
            optimizer.zero_grad()
            out = model(x)
            mu, var = SpeedTCN.decode_predictions(out)
            loss, _ = loss_fn(mu, var, y)
            loss.backward()
            optimizer.step()
            train_loss += loss.item() * len(x)

        train_loss /= len(train_dataset)

        # Validation
        model.eval()
        val_sq_errs = []
        val_variances = []
        with torch.no_grad():
            for x, y in val_loader:
                out = model(x)
                mu, var = SpeedTCN.decode_predictions(out)
                sq_err = (mu - y).squeeze(-1).cpu().numpy() ** 2
                val_sq_errs.extend(sq_err)
                val_variances.extend(var.squeeze(-1).cpu().numpy())

        val_rmse = np.sqrt(np.mean(val_sq_errs))
        # Calibration kappa = sqrt(mean(sq_err) / mean(var)) (§2.1)
        kappa = float(np.sqrt(np.mean(val_sq_errs) / np.mean(val_variances)))

        print(f"Epoch {epoch:02d}/{epochs:02d} | Train Loss: {train_loss:.4f} | "
              f"Val RMSE: {val_rmse:.3f} m/s | Calibrated kappa: {kappa:.3f}")

        if val_rmse < best_val_rmse:
            best_val_rmse = val_rmse
            torch.save({
                "model_state_dict": model.state_dict(),
                "val_rmse": float(val_rmse),
                "kappa": kappa,
                "epoch": epoch
            }, output_pt)

    print(f"Training complete! Best Val RMSE: {best_val_rmse:.3f} m/s saved to {output_pt}.")
    return model


if __name__ == "__main__":
    train_speed_tcn()
