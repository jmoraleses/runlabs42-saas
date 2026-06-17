# WordPress

- id: wordpress
- category: cms
- status: ready
- notes: Local one-click profile generated with runnable commands.

## Install steps

- `if command -v docker >/dev/null 2>&1; then docker rm -f wp-local >/dev/null 2>&1 || true; docker run --name wp-local -p 8080:80 -d wordpress:latest >/dev/null; echo 'WordPress listo: http://localhost:8080'; else echo 'Docker no disponible: WordPress omitido'; fi`
