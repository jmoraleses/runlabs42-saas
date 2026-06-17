import en from './locales/en.js'
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
    s = s.split(`{${k}}`).join(String(v))
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
