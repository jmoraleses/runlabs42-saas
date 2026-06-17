export function buildUndeliveredFilesFixPrompt(opts: {
  paths: string[]
  files: { path: string; content: string }[]
}): string {
  const pathList = opts.paths.map((p) => `- \`${p}\``).join('\n')
  const contextFiles = opts.files
    .filter((f) => /App\.(tsx|jsx)$/i.test(f.path) || f.path === 'index.html' || f.path.endsWith('main.tsx'))
    .slice(0, 8)

  const contextBlock = contextFiles.length
    ? [
        '## Archivos ya presentes (contexto)',
        ...contextFiles.map(
          (f) => `### \`${f.path}\`\n\`\`\`\n${f.content.slice(0, 8000)}\n\`\`\``,
        ),
      ].join('\n\n')
    : ''

  return [
    'La respuesta anterior listó archivos en texto pero NO incluyó su código en bloques markdown.',
    'Genera AHORA el contenido completo de cada archivo faltante de la lista.',
    '',
    'Reglas estrictas:',
    '- UN bloque ``` por archivo, con la ruta en la primera línea del fence (ej. ```tsx src/pages/Home.tsx).',
    '- Código completo y funcional. Sin "// TODO" ni placeholders.',
    '- Cada bloque REEMPLAZA el archivo entero en el workspace.',
    '- Incluye dependencias transitivas: si un archivo importa otro módulo local, créalo también.',
    '- No repitas la lista numerada en prosa: solo bloques de código.',
    '',
    '## Archivos que debes generar ahora',
    pathList,
    '',
    contextBlock,
  ]
    .filter(Boolean)
    .join('\n')
}
