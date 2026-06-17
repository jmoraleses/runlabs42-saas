# Nuxt.js

- id: nuxtjs
- category: framework
- status: ready
- notes: Local one-click profile generated with runnable commands.

## Install steps

- `if [ ! -f package.json ]; then printf '{\n  "name": "nuxt-template",\n  "private": true,\n  "scripts": {"dev": "nuxt dev", "build": "nuxt build"}\n}\n' > package.json; fi`
- `mkdir -p pages && if [ ! -f pages/index.vue ]; then printf '<template><main>Nuxt template listo</main></template>\n' > pages/index.vue; fi`
