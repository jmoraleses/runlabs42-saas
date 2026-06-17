# Gatsby.js

- id: gatsbyjs
- category: framework
- status: ready
- notes: Local one-click profile generated with runnable commands.

## Install steps

- `if [ ! -f package.json ]; then printf '{\n  "name": "gatsby-template",\n  "private": true,\n  "scripts": {"develop": "gatsby develop", "build": "gatsby build"}\n}\n' > package.json; fi`
- `if [ ! -f gatsby-config.js ]; then printf 'module.exports = { siteMetadata: { title: "Gatsby Template" } }\n' > gatsby-config.js; fi`
