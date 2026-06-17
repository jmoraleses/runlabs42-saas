export const AUTO_PHASES = [
  'generate-themes-prompts',
  'stitch-connect',
  'stitch-generate-screens',
  'stitch-fetch-assets',
  'import-local-site',
  'wire-navigation',
  'build-store-templates',
  'generate-covers',
  'package-marketplace',
  'marketplace-fill-upload',
  'saved',
] as const

export type AutoPhaseId = (typeof AUTO_PHASES)[number]

export const PHASE_LABELS: Record<AutoPhaseId, string> = {
  'generate-themes-prompts': 'Temas y prompts IA',
  'stitch-connect': 'Conectar Stitch',
  'stitch-generate-screens': 'Generar pantallas',
  'stitch-fetch-assets': 'Descargar assets',
  'import-local-site': 'Importar al proyecto',
  'wire-navigation': 'Enlaces y manifiesto',
  'build-store-templates': 'Plantillas de tienda',
  'generate-covers': 'Portada Vertex AI',
  'package-marketplace': 'Empaquetar ZIP',
  'marketplace-fill-upload': 'Ficha TemplateMonster',
  saved: 'Completado',
}
