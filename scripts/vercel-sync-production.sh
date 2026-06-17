#!/usr/bin/env bash
# Promote the latest Ready Preview deployment to Production and point
# runlabs42.vercel.app at it. Needed because vercel.json disables deploys
# from main while Production Branch in Vercel is still "main".
set -euo pipefail

SCOPE="${VERCEL_SCOPE:-runlabs42}"
PROJECT="${VERCEL_PROJECT:-runlabs42}"
DOMAIN="${VERCEL_PRODUCTION_DOMAIN:-runlabs42.vercel.app}"

vercel_cmd() {
  if command -v vercel >/dev/null 2>&1; then
    vercel "$@"
  else
    npx vercel "$@"
  fi
}

echo "→ Listing recent Preview deployments (${SCOPE}/${PROJECT})…"
list="$(vercel_cmd ls "${PROJECT}" -S "${SCOPE}" 2>/dev/null || vercel_cmd ls -S "${SCOPE}" 2>/dev/null)"

deploy_url="$(
  echo "${list}" | awk '
    /Preview/ && /Ready/ {
      for (i = 1; i <= NF; i++) {
        if ($i ~ /^https:\/\//) { print $i; exit }
      }
    }
  '
)"

if [[ -z "${deploy_url}" ]]; then
  echo "No Ready Preview deployment found. Push to branch preview and wait for the Vercel build." >&2
  exit 1
fi

echo "→ Promoting ${deploy_url} to Production…"
vercel_cmd promote "${deploy_url}" --yes -S "${SCOPE}"

prod_url="$(vercel_cmd ls "${PROJECT}" -S "${SCOPE}" 2>/dev/null | awk '/Production/ && /Ready/ { for (i=1;i<=NF;i++) if ($i ~ /^https:\/\//) { print $i; exit } }')"
if [[ -z "${prod_url}" ]]; then
  prod_url="${deploy_url}"
fi

echo "→ Assigning ${DOMAIN} → ${prod_url}"
vercel_cmd alias set "${prod_url}" "${DOMAIN}" -S "${SCOPE}"

echo "✓ ${DOMAIN} now serves the latest preview build."
