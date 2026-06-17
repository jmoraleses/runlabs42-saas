# PrestaShop

- id: prestashop
- category: ecommerce
- status: ready
- notes: Local one-click profile generated with runnable commands.

## Install steps

- `if command -v docker >/dev/null 2>&1; then docker rm -f prestashop-local >/dev/null 2>&1 || true; docker run --name prestashop-local -p 8085:80 -d prestashop/prestashop:latest >/dev/null; echo 'PrestaShop listo: http://localhost:8085'; else echo 'Docker no disponible: PrestaShop omitido'; fi`
