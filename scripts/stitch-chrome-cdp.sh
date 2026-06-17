#!/usr/bin/env bash
# Abre Google Chrome con depuración remota para que Playwright use TU sesión de Chrome.
# Cierra Chrome por completo antes de ejecutar este script (Cmd+Q).

set -euo pipefail

PORT="${STITCH_CHROME_CDP_PORT:-9222}"
CHROME_APP="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
CHROME_USER_DATA="${STITCH_CHROME_USER_DATA_DIR:-$HOME/Library/Application Support/Google/Chrome}"

if [[ ! -x "$CHROME_APP" ]]; then
  echo "[stitch-chrome-cdp] No se encontró Google Chrome en: $CHROME_APP"
  exit 1
fi

if pgrep -x "Google Chrome" >/dev/null 2>&1; then
  echo "[stitch-chrome-cdp] Cierra Chrome por completo (Cmd+Q) y vuelve a ejecutar este script."
  exit 1
fi

echo "[stitch-chrome-cdp] Abriendo Chrome con perfil:"
echo "  $CHROME_USER_DATA"
echo "[stitch-chrome-cdp] Puerto depuración: $PORT"

"$CHROME_APP" \
  --remote-debugging-port="$PORT" \
  --user-data-dir="$CHROME_USER_DATA" \
  >/dev/null 2>&1 &

sleep 2
echo ""
echo "Listo. Ahora en otra terminal:"
echo "  STITCH_CHROME_CDP_URL=http://127.0.0.1:$PORT pnpm stitch:auth"
echo ""
echo "Inicia sesión en Stitch con la cuenta definida en STITCH_ACCOUNT_EMAIL en esa ventana de Chrome."
