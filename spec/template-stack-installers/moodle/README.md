# Moodle

- id: moodle
- category: cms
- status: ready
- notes: Local one-click profile generated with runnable commands.

## Install steps

- `if command -v docker >/dev/null 2>&1; then docker rm -f moodle-local >/dev/null 2>&1 || true; docker run --name moodle-local -p 8084:8080 -d bitnami/moodle:latest >/dev/null; echo 'Moodle listo: http://localhost:8084'; else echo 'Docker no disponible: Moodle omitido'; fi`
