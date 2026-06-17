# Magento

- id: magento
- category: ecommerce
- status: ready
- notes: Local one-click profile generated with runnable commands.

## Install steps

- `if command -v docker >/dev/null 2>&1; then docker rm -f magento-local >/dev/null 2>&1 || true; docker run --name magento-local -p 8087:8080 -d bitnami/magento:latest >/dev/null; echo 'Magento listo: http://localhost:8087'; else echo 'Docker no disponible: Magento omitido'; fi`
