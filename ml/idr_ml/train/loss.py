"""Physics-informed kinematic loss and beta-NLL for Speed TCN training.

Implements DOSSIER rev69 §2.1 formulas:
- beta-NLL loss with stop-gradient on sigma^(2*beta) (beta = 0.5)
- Acceleration penalty L_acc beyond a_max
- Jerk penalty L_jerk beyond j_max
- Kinematic consistency loss L_cons against vehicle longitudinal specific force f^v_x
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class KinematicConsistencyLoss(nn.Module):
    """Kinematic loss combining beta-NLL, acceleration limits, jerk limits, and inertial consistency."""

    def __init__(self,
                 beta: float = 0.5,
                 dt_s: float = 0.1,
                 a_max: float = 6.0,
                 j_max: float = 15.0,
                 sigma_c: float = 1.0,
                 lambda_a: float = 0.1,
                 lambda_j: float = 0.05,
                 lambda_c: float = 0.1):
        super().__init__()
        self.beta = beta
        self.dt_s = dt_s
        self.a_max = a_max
        self.j_max = j_max
        self.sigma_c_sq = sigma_c ** 2
        self.lambda_a = lambda_a
        self.lambda_j = lambda_j
        self.lambda_c = lambda_c

    def forward(self,
                mu: torch.Tensor,
                var: torch.Tensor,
                target_speed: torch.Tensor,
                fx_vehicle: torch.Tensor | None = None) -> tuple[torch.Tensor, dict[str, float]]:
        """Calculate total loss.
        Args:
            mu: Predicted forward speed [B, 1] or [B, T]
            var: Predicted speed variance sigma^2 [B, 1] or [B, T]
            target_speed: Ground truth speed [B, 1] or [B, T]
            fx_vehicle: Vehicle frame longitudinal acceleration [B, T] (optional)
        """
        # Ensure flat or shape-matched tensors
        mu_flat = mu.view(-1)
        var_flat = torch.clamp(var.view(-1), min=0.0025, max=25.0)
        target_flat = target_speed.view(-1)

        # 1. beta-NLL with stop-gradient: sg[sigma^(2*beta)] * ((y - mu)^2 / (2*sigma^2) + 0.5 * log(sigma^2))
        sigma_sq = var_flat
        weight = torch.pow(sigma_sq.detach(), self.beta)
        nll = (target_flat - mu_flat) ** 2 / (2.0 * sigma_sq) + 0.5 * torch.log(sigma_sq)
        loss_beta_nll = torch.mean(weight * nll)

        loss_acc = torch.tensor(0.0, device=mu.device)
        loss_jerk = torch.tensor(0.0, device=mu.device)
        loss_cons = torch.tensor(0.0, device=mu.device)

        # If sequence dimension is present, compute derivative terms
        if mu.ndim >= 2 and mu.shape[-1] >= 3:
            # First difference: hat_a_t = (mu_t - mu_{t-1}) / dt
            hat_a = (mu[..., 1:] - mu[..., :-1]) / self.dt_s
            excess_a = F.relu(torch.abs(hat_a) - self.a_max)
            loss_acc = torch.mean(excess_a ** 2)

            # Second difference: hat_j_t = (hat_a_t - hat_a_{t-1}) / dt
            hat_j = (hat_a[..., 1:] - hat_a[..., :-1]) / self.dt_s
            excess_j = F.relu(torch.abs(hat_j) - self.j_max)
            loss_jerk = torch.mean(excess_j ** 2)

            if fx_vehicle is not None and fx_vehicle.shape == hat_a.shape:
                # Consistency with mean subtraction to drop road grade & bias (§2.1)
                a_centered = hat_a - torch.mean(hat_a, dim=-1, keepdim=True)
                fx_centered = fx_vehicle - torch.mean(fx_vehicle, dim=-1, keepdim=True)
                loss_cons = torch.mean((a_centered - fx_centered) ** 2) / self.sigma_c_sq

        total_loss = (loss_beta_nll +
                      self.lambda_a * loss_acc +
                      self.lambda_j * loss_jerk +
                      self.lambda_c * loss_cons)

        metrics = {
            "loss_total": float(total_loss.item()),
            "loss_beta_nll": float(loss_beta_nll.item()),
            "loss_acc": float(loss_acc.item()),
            "loss_jerk": float(loss_jerk.item()),
            "loss_cons": float(loss_cons.item()),
        }

        return total_loss, metrics
