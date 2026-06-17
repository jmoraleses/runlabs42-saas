#!/usr/bin/env bash
set -euo pipefail

if [ ! -f _config.yml ]; then printf 'title: Jekyll Template\n' > _config.yml; fi
mkdir -p _posts && if [ ! -f index.md ]; then printf '# Jekyll template listo\n' > index.md; fi
