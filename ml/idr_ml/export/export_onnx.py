"""Export PyTorch models to ONNX and verify strict numerical parity (< 1e-5).

Exports:
1. models/speed_tcn.onnx: Input 'input' [1, 6, 30] -> Output 'output' [1, 2]
2. models/noise_adapter.onnx: Input 'input' [1, 10, 30] -> Output 'output' [1, 5]
"""

import shutil
from pathlib import Path
import numpy as np
import onnx
import onnxruntime as ort
import torch

from idr_ml.models.speed_tcn import SpeedTCN
from idr_ml.models.noise_adapter import NoiseAdapter


def export_speed_tcn(pt_path: str = "models/speed_tcn.pt",
                     onnx_path: str = "models/speed_tcn.onnx") -> float:
    """Export Speed TCN to ONNX and verify parity."""
    model = SpeedTCN()
    if Path(pt_path).exists():
        ckpt = torch.load(pt_path, map_location="cpu")
        state_dict = ckpt["model_state_dict"] if "model_state_dict" in ckpt else ckpt
        model.load_state_dict(state_dict)
        print(f"Loaded Speed TCN weights from {pt_path}")
    else:
        print("Warning: pt_path not found, exporting with initialized weights.")

    model.eval()

    dummy_input = torch.randn(1, 6, 30, dtype=torch.float32)
    Path(onnx_path).parent.mkdir(parents=True, exist_ok=True)

    torch.onnx.export(
        model,
        dummy_input,
        onnx_path,
        export_params=True,
        opset_version=17,
        do_constant_folding=True,
        dynamo=False,
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={"input": {0: "batch_size"}, "output": {0: "batch_size"}}
    )

    # Check onnx model structure
    onnx_model = onnx.load(onnx_path)
    onnx.checker.check_model(onnx_model)
    print(f"Speed TCN ONNX exported successfully to {onnx_path}")

    # Numerical parity verification
    session = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
    with torch.no_grad():
        pyt_out = model(dummy_input).numpy()

    ort_inputs = {"input": dummy_input.numpy()}
    ort_out = session.run(["output"], ort_inputs)[0]

    max_diff = float(np.max(np.abs(pyt_out - ort_out)))
    print(f"Speed TCN PyTorch vs ONNX max absolute error: {max_diff:.2e}")
    assert max_diff < 1e-5, f"Numerical parity failed! Max error: {max_diff}"

    return max_diff


def export_noise_adapter(pt_path: str = "models/noise_adapter.pt",
                         onnx_path: str = "models/noise_adapter.onnx") -> float:
    """Export Noise Adapter to ONNX and verify parity."""
    model = NoiseAdapter()
    if Path(pt_path).exists():
        ckpt = torch.load(pt_path, map_location="cpu")
        state_dict = ckpt["model_state_dict"] if "model_state_dict" in ckpt else ckpt
        model.load_state_dict(state_dict)
        print(f"Loaded Noise Adapter weights from {pt_path}")
    else:
        print("Warning: pt_path not found, exporting with initialized weights.")

    model.eval()

    dummy_input = torch.randn(1, 10, 30, dtype=torch.float32)
    Path(onnx_path).parent.mkdir(parents=True, exist_ok=True)

    torch.onnx.export(
        model,
        dummy_input,
        onnx_path,
        export_params=True,
        opset_version=17,
        do_constant_folding=True,
        dynamo=False,
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={"input": {0: "batch_size"}, "output": {0: "batch_size"}}
    )

    onnx_model = onnx.load(onnx_path)
    onnx.checker.check_model(onnx_model)
    print(f"Noise Adapter ONNX exported successfully to {onnx_path}")

    session = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
    with torch.no_grad():
        pyt_out = model(dummy_input).numpy()

    ort_inputs = {"input": dummy_input.numpy()}
    ort_out = session.run(["output"], ort_inputs)[0]

    max_diff = float(np.max(np.abs(pyt_out - ort_out)))
    print(f"Noise Adapter PyTorch vs ONNX max absolute error: {max_diff:.2e}")
    assert max_diff < 1e-5, f"Numerical parity failed! Max error: {max_diff}"

    return max_diff


def export_all():
    print("=== Exporting Speed TCN ===")
    export_speed_tcn()
    print("\n=== Exporting Noise Adapter ===")
    export_noise_adapter()
    print("\nAll models successfully exported with parity < 1e-5.")


if __name__ == "__main__":
    export_all()
