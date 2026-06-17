#!/usr/bin/env bash
set -euo pipefail

if command -v docker >/dev/null 2>&1; then docker rm -f magento-local >/dev/null 2>&1 || true; docker run --name magento-local -p 8087:8080 -d bitnami/magento:latest >/dev/null; echo 'Magento listo: http://localhost:8087'; else echo 'Docker no disponible: Magento omitido'; fi
