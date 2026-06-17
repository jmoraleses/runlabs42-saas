#!/usr/bin/env bash
set -euo pipefail

if command -v docker >/dev/null 2>&1; then docker rm -f drupal-local >/dev/null 2>&1 || true; docker run --name drupal-local -p 8083:80 -d drupal:latest >/dev/null; echo 'Drupal listo: http://localhost:8083'; else echo 'Docker no disponible: Drupal omitido'; fi
