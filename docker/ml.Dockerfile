# IDR 26168 Machine Learning Container
FROM python:3.11-slim

WORKDIR /workspace

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt* ./
RUN pip install --no-cache-dir \
    torch \
    onnx \
    onnxruntime \
    pandas \
    pyarrow \
    numpy \
    scipy

CMD ["python", "ml/idr_ml/eval/benchmark.py"]
