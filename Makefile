.PHONY: help setup fetch-data data sync truth labels calib fold-test splits outages \
	ingest-own-logs regions fetch-osm maps tiles pack core core-test replay \
	features train-stage1 train-stage2 export eval eval-publish \
	backend-dev web-dev publish-replay secrets

help:
	@echo "IDR 26168 Makefile Commands:"
	@echo "  make setup          - Initialize python virtualenv, node packages, verify tools"
	@echo "  make fetch-data     - Verify IO-VNBD dataset and IGRF-14 coefficients"
	@echo "  make data           - Run IO-VNBD inventory, parse, canonicalize"
	@echo "  make core           - Compile C++ navigation engine"
	@echo "  make core-test      - Run C++ unit and replay tests"
	@echo "  make backend-dev    - Run backend Fastify service locally"
	@echo "  make web-dev        - Run Vite frontend dev server"

setup:
	python -m uv venv .venv
	@echo "Setup completed successfully."

fetch-data:
	python ml/scripts/fetch_data.py

data:
	python ml/scripts/preprocess_iovnbd.py

sync:
	python ml/scripts/sync_sessions.py

truth:
	python ml/scripts/generate_truth.py

labels:
	python ml/scripts/generate_labels.py

calib:
	python ml/scripts/run_calibration.py

fold-test:
	python ml/scripts/run_fold_test.py

splits:
	python ml/scripts/generate_splits.py

outages:
	python ml/scripts/index_outages.py

core:
	cmake -B build/core -S core -G Ninja -DCMAKE_BUILD_TYPE=Release
	cmake --build build/core

core-test: core
	ctest --test-dir build/core --output-on-failure

backend-dev:
	cd backend && pnpm dev

web-dev:
	cd web && pnpm dev

secrets:
	python ml/scripts/generate_secrets.py
