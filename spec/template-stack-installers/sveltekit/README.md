# SvelteKit

- id: sveltekit
- category: framework
- status: ready
- notes: Local one-click profile generated with runnable commands.

## Install steps

- `if [ ! -f package.json ]; then printf '{\n  "name": "sveltekit-template",\n  "private": true,\n  "scripts": {"dev": "vite dev", "build": "vite build"}\n}\n' > package.json; fi`
- `mkdir -p src/routes && if [ ! -f src/routes/+page.svelte ]; then printf '<main>SvelteKit template listo</main>\n' > src/routes/+page.svelte; fi`
