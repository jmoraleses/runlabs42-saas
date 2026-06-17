import { snippetAroundLine } from '@/lib/preview/parseCompileError'

export function buildCompileFixPrompt(opts: {
  error: string
  path: string
  line: number | null
  content: string
}): string {
  const missing = !opts.content.trim()
  const snippet = snippetAroundLine(opts.content, opts.line)
  const loc = opts.line != null ? ` (línea ${opts.line})` : ''

  const fileSection = missing
    ? [
        `## Archivo a crear: \`${opts.path}\``,
        '',
        'El archivo no existe en el workspace o está vacío. Créalo con el módulo mínimo necesario',
        '(export default) para que el import del error compile. Conserva el resto del proyecto intacto.',
      ]
    : [
        `## Archivo a corregir: \`${opts.path}\`${loc}`,
        '',
        opts.line != null
          ? 'Zona cercana al error (la línea marcada con `>` está cerca del problema):'
          : 'Contenido actual:',
        '```',
        snippet,
        '```',
        '',
        'Contenido completo del archivo:',
        '```',
        opts.content,
        '```',
      ]

  return [
    'El preview del proyecto no compila o falla al ejecutarse. Corrige ÚNICAMENTE lo necesario para resolver el error.',
    '',
    'Reglas estrictas:',
    '- Modifica solo la causa del error; conserva el resto del archivo (imports, componentes, estilos, textos).',
    '- No sustituyas la UI por mensajes genéricos ni por otra aplicación distinta.',
    '- No añadas páginas legales, footers ni branding no solicitado.',
    '- Devuelve bloques de código con la ruta en la primera línea de cada fence, p. ej. ```tsx src/App.tsx',
    '- Cada archivo devuelto debe ser el contenido completo y válido.',
    '',
    '## Error del preview',
    '```',
    opts.error.trim(),
    '```',
    '',
    ...fileSection,
  ].join('\n')
}
