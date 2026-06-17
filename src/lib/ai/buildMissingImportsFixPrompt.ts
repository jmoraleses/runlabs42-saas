import type { MissingLocalImport } from '@/lib/ai/resolveLocalImport'

export function buildMissingImportsFixPrompt(opts: {
  missing: MissingLocalImport[]
  files: { path: string; content: string }[]
}): string {
  const missingList = opts.missing
    .map(
      (m) =>
        `- \`${m.path}\` (import \`${m.spec}\` desde ${m.importedFrom.map((p) => `\`${p}\``).join(', ')})`,
    )
    .join('\n')

  const contextFiles = opts.files
    .filter((f) =>
      opts.missing.some((m) => m.importedFrom.includes(f.path) || f.path.includes('App.')),
    )
    .slice(0, 6)

  const contextBlock = contextFiles.length
    ? [
        '## Archivos que referencian los módulos faltantes',
        ...contextFiles.map(
          (f) => `### \`${f.path}\`\n\`\`\`\n${f.content.slice(0, 6000)}\n\`\`\``,
        ),
      ].join('\n\n')
    : ''

  return [
    'Faltan archivos en el proyecto: hay imports relativos a módulos que no existen. Créalos ahora.',
    '',
    'Reglas estrictas:',
    '- Genera UN bloque markdown por cada archivo faltante, con la ruta en la primera línea del fence.',
    '- Código completo y funcional (export default o named exports según el import). Sin "// TODO" ni placeholders.',
    '- Puedes sobrescribir archivos existentes; cada bloque con ruta reemplaza el archivo entero.',
    '- No reescribas archivos que ya están correctos salvo que sea imprescindible para que compile el import.',
    '- Usa la misma convención del proyecto (React + Tailwind si aplica, rutas bajo src/).',
    '- Incluye también dependencias transitivas: si un archivo nuevo importa otro módulo local, créalo en la misma respuesta.',
    '',
    '## Archivos que debes crear',
    missingList,
    '',
    contextBlock,
  ]
    .filter(Boolean)
    .join('\n')
}
