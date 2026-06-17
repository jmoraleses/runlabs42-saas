/**
 * Split i18n.js into per-locale modules (<100kiB each) for webpack cache.
 * Run: node scripts/split-webpack-large-modules.mjs
 * (requires src/i18n.js — after split, delete it and use src/i18n/index.js)
 */
import fs from 'fs'
import path from 'path'

const root = path.join(import.meta.dirname, '..')
const i18nPath = path.join(root, 'src/i18n.js')
if (!fs.existsSync(i18nPath)) {
  console.log('src/i18n.js not found — already split (src/i18n/index.js)')
  process.exit(0)
}

function writeLocale(code, startLine, endLine) {
  const lines = fs.readFileSync(path.join(root, 'src/i18n.js'), 'utf8').split('\n')
  const body = lines.slice(startLine - 1, endLine).join('\n')
  const dir = path.join(root, 'src/i18n/locales')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, `${code}.js`),
    `/** Runlabs42 i18n — ${code} */\nexport default {\n${body}\n}\n`,
  )
}

const locales = [
  ['en', 8, 993],
  ['es', 1002, 1975],
  ['fr', 1979, 2332],
  ['de', 2336, 2689],
  ['nl', 2693, 3046],
  ['it', 3050, 3403],
]
for (const [code, start, end] of locales) writeLocale(code, start, end)

const i18nTail = `import en from './locales/en.js'
import es from './locales/es.js'
import fr from './locales/fr.js'
import de from './locales/de.js'
import nl from './locales/nl.js'
import it from './locales/it.js'

export const SK_I18N = { en, es, fr, de, nl, it }

/** Reemplaza {placeholders} en cadenas i18n. */
export function formatT(t, key, vars = {}) {
  let s = t(key)
  for (const [k, v] of Object.entries(vars)) {
    s = s.split(\`{\${k}}\`).join(String(v))
  }
  return s
}

export const SK_LANGS = [
  { code: 'en', label: 'English', flag: 'EN' },
  { code: 'es', label: 'Español', flag: 'ES' },
  { code: 'fr', label: 'Français', flag: 'FR' },
  { code: 'de', label: 'Deutsch', flag: 'DE' },
  { code: 'nl', label: 'Nederlands', flag: 'NL' },
  { code: 'it', label: 'Italiano', flag: 'IT' },
]
`
fs.mkdirSync(path.join(root, 'src/i18n'), { recursive: true })
fs.writeFileSync(path.join(root, 'src/i18n/index.js'), i18nTail)

console.log('Split i18n → src/i18n/locales/*.js + src/i18n/index.js')
console.log('Update src/lib/i18n.ts → ../i18n/index.js, then delete src/i18n.js')
