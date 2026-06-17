# Jekyll

- id: jekyll
- category: framework
- status: ready
- notes: Local one-click profile generated with runnable commands.

## Install steps

- `if [ ! -f _config.yml ]; then printf 'title: Jekyll Template\n' > _config.yml; fi`
- `mkdir -p _posts && if [ ! -f index.md ]; then printf '# Jekyll template listo\n' > index.md; fi`
