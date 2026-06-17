#!/usr/bin/env bash
# Reinicia el dev server sin caché ni procesos zombie.
# El puerto 3000 suele estar ocupado (p. ej. WhatsApp bridge de Hermes).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-3010}"
cd "$ROOT"

echo "→ Deteniendo instancias previas de next dev en este proyecto…"
pkill -f "${ROOT}/node_modules/.bin/next dev" 2>/dev/null || true
pkill -f "next dev -p ${PORT}" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
sleep 1

echo "→ Limpiando cachés de compilación…"
rm -rf .next .next-production-build node_modules/.cache .turbo

echo "→ Sincronizando dependencias (pnpm)…"
pnpm install --no-frozen-lockfile

echo "→ Arrancando Next en http://localhost:${PORT}"
echo "   Tras cambiar next.config.mjs: para el servidor (Ctrl+C) y vuelve a ejecutar dev:clean."
echo "   (Si el navegador sigue fallando: vacía caché de localhost o Cmd+Shift+R)"
# Node 25+: dependencias (p. ej. google-auth-library) aún usan url.parse() → DEP0169
case "${NODE_OPTIONS:-}" in
  *DEP0169*) ;;
  *) export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--disable-warning=DEP0169" ;;
esac
# pnpm exec / npx bajo pnpm inyectan env npm_* que npm 10+ avisa como desconocidas; usar el binario local.
exec ./node_modules/.bin/next dev -p "$PORT"
