# Drupal

- id: drupal
- category: cms
- status: ready
- notes: Local one-click profile generated with runnable commands.

## Install steps

- `if command -v docker >/dev/null 2>&1; then docker rm -f drupal-local >/dev/null 2>&1 || true; docker run --name drupal-local -p 8083:80 -d drupal:latest >/dev/null; echo 'Drupal listo: http://localhost:8083'; else echo 'Docker no disponible: Drupal omitido'; fi`
