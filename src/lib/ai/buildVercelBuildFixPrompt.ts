export function buildVercelBuildFixPrompt(opts: {
  buildLog: string
  path: string
  content: string
}): string {
  const log = opts.buildLog.trim().slice(-12_000)
  return [
    'El preview en Vercel falló al compilar o desplegar. Corrige el código según los logs de build.',
    '',
    '## Logs de Vercel',
    '```',
    log || '(sin logs)',
    '```',
    '',
    `## Archivo principal: \`${opts.path}\``,
    '```',
    opts.content.slice(0, 24_000),
    '```',
    '',
    'Reglas:',
    '- Corrige solo lo necesario para que el build pase.',
    '- Devuelve los archivos modificados en bloques de código con ruta.',
    '- No redeployes; el usuario lanzará el preview manualmente.',
  ].join('\n')
}
