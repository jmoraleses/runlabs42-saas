import Module from 'node:module'
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const originalLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (request === 'server-only') {
    return {}
  }
  return originalLoad.apply(this, arguments)
}

const dir = dirname(fileURLToPath(import.meta.url))
register(pathToFileURL(resolve(dir, 'server-only-hook.mjs')).href, import.meta.url)
