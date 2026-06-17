/** Etiqueta de atajo (⌘ en macOS, Ctrl+ en el resto). */
export function formatShortcut(parts: {
  mod?: boolean
  shift?: boolean
  key: string
}): string {
  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPod|iPad/i.test(navigator.platform)

  const tokens: string[] = []
  if (parts.mod) tokens.push(isMac ? '⌘' : 'Ctrl+')
  if (parts.shift) tokens.push(isMac ? '⇧' : 'Shift+')
  tokens.push(parts.key)
  return isMac && parts.mod ? tokens.join('') : tokens.join('')
}
