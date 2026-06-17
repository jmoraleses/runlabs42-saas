#!/usr/bin/env bash
# Instala el wheel del orquestador durante el build del contenedor Agent Engine.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
pip install --no-cache-dir "$ROOT"/wheels/*.whl
