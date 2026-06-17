#!/usr/bin/env bash
set -euo pipefail

if command -v docker >/dev/null 2>&1; then
  docker network inspect cms-net >/dev/null 2>&1 || docker network create cms-net >/dev/null
  docker rm -f joomla-local joomla-db-local >/dev/null 2>&1 || true
  docker run --name joomla-db-local --network cms-net -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=joomla -e MYSQL_USER=joomla -e MYSQL_PASSWORD=joomla -d mariadb:10.11 >/dev/null
  docker run --name joomla-local --network cms-net -p 8082:80 \
    -e JOOMLA_DB_HOST=joomla-db-local \
    -e JOOMLA_DB_USER=joomla \
    -e JOOMLA_DB_PASSWORD=joomla \
    -e JOOMLA_DB_NAME=joomla \
    -e JOOMLA_SITE_NAME='Template Studio Joomla' \
    -e JOOMLA_ADMIN_USER='Template Admin' \
    -e JOOMLA_ADMIN_USERNAME=admin \
    -e JOOMLA_ADMIN_PASSWORD='Admin1234!Seed' \
    -e JOOMLA_ADMIN_EMAIL=admin@example.com \
    -d joomla:latest >/dev/null
  echo 'Joomla listo: http://localhost:8082 (DB: joomla-db-local)'
else
  echo 'Docker no disponible: Joomla omitido'
fi
