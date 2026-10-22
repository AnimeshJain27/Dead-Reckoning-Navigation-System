"""Noise Adapter PyTorch Model (6,949 parameters).

Architecture: 2-layer Conv1d with dilation + linear head.
Input: X_k in R^(B x 10 x 30) representing [f^v; omega^v; ell_fz; ell_fy; ell_omega_x; mu].
Output: z_k in R^(B x 5), transformed to alpha_k = 10^(3 * tanh(z_k)) in [10^-3, 10^3]^5.
Outputs scale:
  alpha_1: R_NHC_lat
  alpha_2: R_NHC_up
  alpha_3: R_speed
  alpha_4: Q_a (accelerometer process noise)
  alpha_5: Q_omega (gyroscope process noise)
Reference: DOSSIER rev69 §2.1, §4.2.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class NoiseAdapter(nn.Module):
    """Vibration-envelope driven noise scaling network."""

    def __init__(self):
        super().__init__()
        # Conv 1: 10 -> 32, k=5, dilation=1 (parameters: 32*10*5 + 32 = 1,632)
        self.conv1 = nn.Conv1d(10, 32, kernel_size=5, dilation=1)
        self.drop1 = nn.Dropout(0.2)

        # Conv 2: 32 -> 32, k=5, dilation=3 (parameters: 32*32*5 + 32 = 5,152)
        self.conv2 = nn.Conv1d(32, 32, kernel_size=5, dilation=3)
        self.drop2 = nn.Dropout(0.2)

        # Head: 32 -> 5 (parameters: 5*32 + 5 = 165)
        self.head = nn.Linear(32, 5)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Forward pass.
        Args:
            x: Input tensor [B, 10, 30]
        Returns:
            z: Log-scale activations [B, 5]
        """
        h1 = F.relu(self.conv1(x))
        h1 = self.drop1(h1)
        h2 = F.relu(self.conv2(h1))
        h2 = self.drop2(h2)

        last = h2[:, :, -1]
        z = self.head(last)
        return z

    @staticmethod
    def decode_alphas(z: torch.Tensor) -> torch.Tensor:
        """Transform linear logits to positive bounded scale factors in [10^-3, 10^3].
        alpha = 10^(3 * tanh(z))
        """
        return torch.pow(10.0, 3.0 * torch.tanh(z))
