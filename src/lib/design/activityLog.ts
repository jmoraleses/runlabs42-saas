/** Quita aclaraciones entre paréntesis en mensajes del log de diseño. */
export function stripDesignLogParentheticals(message: string): string {
  return message.replace(/\s*\([^)]*\)/g, '')
}

/** Sustituye `{key}` / `{{key}}` en cadenas i18n (el helper `t` no interpola). */
export function formatDesignActivityMessage(
  template: string,
  vars?: Record<string, string>,
): string {
  if (!vars) return template
  let out = template
  for (const [key, value] of Object.entries(vars)) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    out = out
      .replace(new RegExp(`\\{\\{${escaped}\\}\\}`, 'g'), value)
      .replace(new RegExp(`\\{${escaped}\\}`, 'g'), value)
  }
  return out
}

export function humanizeDesignPageId(pageId: string): string {
  if (pageId === 'home' || pageId === 'index') return 'Inicio'
  return pageId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
