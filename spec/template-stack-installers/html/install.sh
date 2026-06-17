#!/usr/bin/env bash
set -euo pipefail

mkdir -p preview && if [ ! -f preview/index.html ]; then printf '<!doctype html><html><head><meta charset="utf-8"><title>HTML Template</title></head><body><h1>HTML template listo</h1></body></html>\n' > preview/index.html; fi
echo 'HTML scaffold listo en preview/index.html'
