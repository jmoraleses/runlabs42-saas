# OpenCart

- id: opencart
- category: ecommerce
- status: ready
- notes: Local one-click profile generated with runnable commands.

## Install steps

- `if command -v docker >/dev/null 2>&1; then docker rm -f opencart-local >/dev/null 2>&1 || true; docker run --name opencart-local -p 8086:8080 -d bitnami/opencart:latest >/dev/null; echo 'OpenCart listo: http://localhost:8086'; else echo 'Docker no disponible: OpenCart omitido'; fi`
