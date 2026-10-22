"""Speed TCN PyTorch Model (16,418 parameters).

Architecture: Causal Dilated Temporal Convolutional Network.
Input: X_k in R^(B x 6 x 30) representing [f^v; omega^v] over 30 samples (3s @ 10 Hz).
Output: [o_1, o_2] in R^(B x 2) representing:
  - mu_k = softplus(o_1)
  - s_k = log(sigma_k^2) clipped in [log(0.05^2), log(5.0^2)]
Receptive field: 29 samples.
MACs per step: 16,192 streamed; 483,904 full window.
Reference: DOSSIER rev69 §3.2, §4.2.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class CausalConv1d(nn.Module):
    """1D causal convolution with left padding = (kernel_size - 1) * dilation."""

    def __init__(self, in_channels: int, out_channels: int, kernel_size: int, dilation: int = 1):
        super().__init__()
        self.pad = (kernel_size - 1) * dilation
        self.conv = nn.Conv1d(in_channels, out_channels, kernel_size=kernel_size, dilation=dilation)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Left-pad time dimension (last dim)
        x = F.pad(x, (self.pad, 0))
        return self.conv(x)


class SpeedTCN(nn.Module):
    """Physics-informed causal TCN for forward vehicle speed estimation."""

    def __init__(self):
        super().__init__()
        # Block 1: 6 -> 32, k=3, d=1
        self.b1_conv1 = CausalConv1d(6, 32, kernel_size=3, dilation=1)
        self.b1_drop = nn.Dropout(0.1)
        self.b1_conv2 = CausalConv1d(32, 32, kernel_size=3, dilation=1)
        self.b1_skip = nn.Conv1d(6, 32, kernel_size=1)

        # Block 2: 32 -> 32, k=3, d=2
        self.b2_conv1 = CausalConv1d(32, 32, kernel_size=3, dilation=2)
        self.b2_drop = nn.Dropout(0.1)
        self.b2_conv2 = CausalConv1d(32, 32, kernel_size=3, dilation=2)

        # Block 3: 32 -> 32, k=3, d=4
        self.b3_conv1 = CausalConv1d(32, 32, kernel_size=3, dilation=4)
        self.b3_drop = nn.Dropout(0.1)
        self.b3_conv2 = CausalConv1d(32, 32, kernel_size=3, dilation=4)

        # Linear regression head: 32 -> 2
        self.head = nn.Linear(32, 2)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Forward pass.
        Args:
            x: Input tensor [B, 6, 30]
        Returns:
            Raw logits [B, 2] (o_1, o_2)
        """
        # Block 1
        res1 = self.b1_skip(x)
        h1 = F.relu(self.b1_conv1(x))
        h1 = self.b1_drop(h1)
        h1 = self.b1_conv2(h1)
        x1 = F.relu(h1 + res1)

        # Block 2
        res2 = x1
        h2 = F.relu(self.b2_conv1(x1))
        h2 = self.b2_drop(h2)
        h2 = self.b2_conv2(h2)
        x2 = F.relu(h2 + res2)

        # Block 3
        res3 = x2
        h3 = F.relu(self.b3_conv1(x2))
        h3 = self.b3_drop(h3)
        h3 = self.b3_conv2(h3)
        x3 = F.relu(h3 + res3)

        # Last time step representation
        last = x3[:, :, -1]
        out = self.head(last)
        return out

    @staticmethod
    def decode_predictions(out: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        """Convert raw logits to calibrated speed mu and variance sigma^2.
        mu = softplus(o_1)
        var = exp(clip(o_2, log(0.05^2), log(5^2)))
        """
        mu = F.softplus(out[:, 0:1])
        log_var = torch.clamp(out[:, 1:2], min=-5.99146, max=3.21887)
        var = torch.exp(log_var)
        return mu, var
