import type { AICommand } from '@/types'
import { buildPrompt } from '@/lib/ai/prompts'
import { toVertexModelId } from '@/lib/ai/constants'
import { getVertexAICredentials } from '@/lib/ai/config.server'
import { getVertexBearerToken } from '@/lib/ai/vertexAgentPlatform'
import {
  buildVertexPublisherUrl,
  resolveVertexModelRoute,
  resolveVertexPublisher,
  streamAgentPlatformText,
  type TokenUsage,
} from '@/lib/ai/vertexAgentPlatform'
import { emptyTokenUsage, mergeTokenUsage } from '@/lib/billing/tokenCredits'
import {
  shouldRunOcrThenCodePipeline,
  type ResolvedCategoryStreamModels,
} from '@/lib/ai/resolveCategoryStreamModel'
import { usageFromGeminiChunk, usageFromGeminiResponseText } from '@/lib/billing/tokenUsage'
import { MAX_CHAT_IMAGES } from '@/lib/chat/imageAttachments'
import {
  fileOpsFromNewlyCompletedSegments,
  parseFileOperationsFromStream,
} from '@/lib/ai/parseAssistantOutput'
import { buildSpecKitContextBlock, specKitSystemHint } from '@/lib/ai/spec-kit/prompts'
import { parseSpeckitCommand } from '@/lib/ai/spec-kit/commands'
import type { SpecKitArtifacts } from '@/lib/ai/spec-kit/artifacts'
import { buildChatHistoryBlock } from '@/lib/ai/chatHistory'
import type { ChatMessage } from '@/lib/chat/types'
import { exportableContextBlock } from '@/lib/ai/exportableAppHints'
import { workspaceEditContextBlock } from '@/lib/ai/workspaceEditHints'
import { resolveStreamDefaultPath } from '@/lib/projects/resolveStreamDefaultPath'
import { getOrCreateCache } from '@/lib/ai/geminiCache'
import { modelSupportsCaching } from '@/lib/ai/models'

const MAX_CODE_CHARS = 24_000
const MAX_FILES = 24
const MAX_FILE_CHARS = 8_000
const MAX_ACTIVE_FILE_CHARS = 32_000

export type GeminiStreamFile = { path: string; content: string }

export type GeminiImagePart = {
  mimeType: string
  data: string
}

export type GeminiStreamContext = {
  projectId?: string
  projectName?: string
  framework?: string
  targetPlatforms?: string[]
  activePath?: string
  code?: string
  files?: GeminiStreamFile[]
  specKitArtifacts?: SpecKitArtifacts
  images?: GeminiImagePart[]
  useSpecKit?: boolean
  thinkingLevel?: 'minimal' | 'medium' | 'high'
  chatHistory?: ChatMessage[]
  memoryBlock?: string
  resolvedCategoryModels?: ResolvedCategoryStreamModels
}

export type SSESend = (type: string, data: string) => void

function streamParseOptions(ctx: GeminiStreamContext) {
  const existingPaths = ctx.files?.map((f) => f.path) ?? []
  return {
    defaultPath: resolveStreamDefaultPath(ctx.activePath, existingPaths),
    existingPaths,
  }
}

/** Emite `file_delta` por cada bloque ``` que acaba de cerrarse. */
export function emitNewlyCompletedFileDeltas(
  prevText: string,
  nextText: string,
  ctx: GeminiStreamContext,
  send: SSESend,
): number {
  const ops = fileOpsFromNewlyCompletedSegments(prevText, nextText, streamParseOptions(ctx))
  let n = 0
  for (const op of ops) {
    if (op.type === 'delete') continue
    send('file_delta', JSON.stringify({ path: op.path, content: op.content }))
    n += 1
  }
  return n
}

export function emitFileUpdatesFromText(
  fullText: string,
  ctx: GeminiStreamContext,
  send: SSESend,
): number {
  if (!fullText.trim()) return 0
  const ops = parseFileOperationsFromStream(fullText, streamParseOptions(ctx))
  const files = ops
    .filter((o) => o.type !== 'delete')
    .map((o) => ({ path: o.path, content: o.content }))
  if (files.length) send('files', JSON.stringify(files))
  return files.length
}

const COMMAND_HINTS: Record<AICommand['command'], string> = {
  '/plan':
    'Responde con un plan estructurado (fases, riesgos, entregables). No generes archivos completos salvo que el usuario lo pida.',
  '/spec':
    'Responde con una especificación técnica y criterios de aceptación verificables.',
  '/build':
    `Genera o actualiza código del proyecto.

REGLAS DE FORMATO — MUY IMPORTANTES:
- Cada archivo va en su propio bloque markdown con la ruta en la PRIMERA LÍNEA del fence.
  Ejemplos correctos: \`\`\`tsx src/App.tsx   \`\`\`js game.js   \`\`\`html index.html   \`\`\`css style.css
- Código completo y funcional en cada archivo — nunca placeholders ni "// TODO".
- Puedes SOBRESCRIBIR archivos existentes: cada bloque con ruta reemplaza el archivo entero en el workspace.
- Edición dirigida: no cambies a otra app distinta; sobrescribe con contenido completo solo los archivos que el pedido requiera.
- DEPENDENCIAS COMPLETAS: cada import relativo (./pages/X, ../context/Y) exige el archivo correspondiente en la misma respuesta.
  Si devuelves src/App.tsx con imports a páginas, context o componentes, incluye TODOS esos archivos en bloques separados.
  Revisa App.tsx antes de terminar: ningún import debe quedar sin archivo generado.
- NO describas archivos solo en listas numeradas o prosa: cada archivo que menciones DEBE tener su bloque \`\`\` con código completo.
  Prohibido listar "12 archivos" y enviar solo 3 bloques de código; si no cabe todo, prioriza App.tsx, páginas, context y componentes importados.

TIPOS DE PROYECTO:
▸ React/Next: componentes funcionales + Tailwind. Estructura: src/App.tsx (rutas), src/pages/*, src/components/*, src/context/*.
  Páginas nuevas en src/pages/, rutas en App con react-router-dom.
▸ HTML/CSS/JS vanilla: usa index.html como entrada. Inicia con <!DOCTYPE html>. Estilos en style.css, lógica en main.js.
▸ Dibujo (canvas-app): index.html + style.css + app.js. Canvas 2D con brush, colores, undo, export PNG. Responsive y táctil.
▸ Juego canvas (canvas-game): index.html + style.css + game.js. Game loop con requestAnimationFrame, canvas 2D API nativa.
▸ Sketch p5.js: index.html + style.css + sketch.js con CDN p5. Usa setup()/draw(). CDN: https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.4/p5.min.js
▸ Phaser 3: index.html + style.css + game.js con CDN Phaser. CDN: https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js
▸ Three.js: index.html + style.css + main.js con CDN Three. CDN: https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js

Para canvas-app, canvas-game, p5, phaser, three:
- Genera HTML puro (no React). Meta viewport width=device-width. CSS mobile-first (100dvh, safe-area).
- Juegos: jugables de inmediato (controles, loop, puntuación, game over). Táctil + teclado.
- Dibujo: herramientas visibles desde el primer frame.
- NUNCA pantalla en blanco; siempre contenido visual al cargar.

Nunca sustituyas la UI por mensajes genéricos tipo "la aplicación funciona correctamente" ni placeholders.`,
  '/review':
    'Responde con hallazgos priorizados (tabla o lista) y sugerencias concretas de diff.',
  '/css':
    'Prioriza cambios CSS/Tailwind en bloques ```css o clases en ```tsx.',
  '/mobile-fix':
    'Corrige problemas de preparación para App Store y Google Play. Mobile-first, manifest y viewport.',
}

function buildGeminiPrompt(command: AICommand, ctx: GeminiStreamContext): string {
  const useSpecKit = ctx.useSpecKit === true
  const speckit = useSpecKit
    ? parseSpeckitCommand(`${command.command} ${command.prompt}`.trim())
    : null
  const parts: string[] = [
    'Eres el motor de IA del editor Runlabs42.',
    'Responde en el mismo idioma que el usuario (español si no está claro).',
    speckit ? specKitSystemHint(speckit.phase) : COMMAND_HINTS[command.command],
    '',
    buildPrompt(command),
  ]

  if (ctx.projectName || ctx.projectId) {
    parts.push('', '## Proyecto', ctx.projectName ?? '(sin nombre)', ctx.projectId ? `id: ${ctx.projectId}` : '')
  }
  if (ctx.framework) {
    const fwHints: Record<string, string> = {
      'canvas-app':
        'App de dibujo canvas (HTML + app.js). Brush, colores, táctil, responsive. NO uses React.',
      'canvas-game':
        'Juego canvas (HTML + game.js). requestAnimationFrame, táctil. NO uses React.',
      p5: 'Sketch p5.js (HTML + sketch.js + CDN p5). setup()/draw(). NO uses React.',
      phaser: 'Juego Phaser 3 (HTML + game.js + CDN). Escenas y física arcade. NO uses React.',
      three: 'Escena Three.js (HTML + main.js + CDN). WebGL responsive. NO uses React.',
      vanilla: 'Proyecto HTML/CSS/JS vanilla. index.html + style.css + main.js. NO uses React.',
    }
    const hint = fwHints[ctx.framework] ?? ''
    parts.push('', `Framework: ${ctx.framework}${hint ? ` — ${hint}` : ''}`)
  }
  parts.push('', exportableContextBlock({ framework: ctx.framework, targetPlatforms: ctx.targetPlatforms }))
  if (useSpecKit && ctx.specKitArtifacts) {
    const block = buildSpecKitContextBlock(ctx.specKitArtifacts)
    if (block) parts.push('', '## Artefactos Spec-Kit', block)
  }
  if (ctx.activePath) parts.push('', `## Archivo activo\n\`${ctx.activePath}\``)
  if (ctx.code?.trim()) {
    const snippet =
      ctx.code.length > MAX_CODE_CHARS
        ? `${ctx.code.slice(0, MAX_CODE_CHARS)}\n\n… (truncado)`
        : ctx.code
    parts.push('', '## Código del archivo activo', '```', snippet, '```')
  }

  if (ctx.memoryBlock?.trim()) parts.push(ctx.memoryBlock)
  const historyBlock = buildChatHistoryBlock(ctx.chatHistory ?? [])
  if (historyBlock) parts.push(historyBlock)

  if (ctx.files?.length) {
    parts.push(
      '',
      '## Archivos del workspace (estado actual)',
      '',
      'Edición en proyecto existente:',
      workspaceEditContextBlock(),
      '- El proyecto YA existe; no lo sustituyas por otra app ni plantilla distinta sin que el usuario lo pida.',
      '- Conserva imports, estado, handlers, rutas y componentes no relacionados con el pedido.',
      '- Si el usuario pide estilo/UI, mantén la misma estructura JSX y lógica; cambia clases/colores/espaciado.',
      '- Devuelve los archivos que debas cambiar; cada uno con el contenido completo y final (sobrescribe el archivo en disco).',
      '- Si generas componentes o páginas nuevas, sobrescribe src/App.tsx para importarlos y mostrarlos en el preview.',
      '- Para páginas nuevas: archivo en src/pages/ + actualización de rutas en src/App.tsx.',
      '- Si App.tsx importa un módulo local que no existe en la lista de archivos, créalo en esta misma respuesta.',
      '- No dejes textos de bienvenida, marca ni mensajes de estado en App; solo la UI pedida.',
    )
    const active = ctx.activePath
    const sorted = [...ctx.files].sort((a, b) => {
      if (a.path === active) return -1
      if (b.path === active) return 1
      return a.path.localeCompare(b.path)
    })
    for (const f of sorted.slice(0, MAX_FILES)) {
      const limit = f.path === active ? MAX_ACTIVE_FILE_CHARS : MAX_FILE_CHARS
      const body =
        f.content.length > limit
          ? `${f.content.slice(0, limit)}\n… (truncado)`
          : f.content
      parts.push('', `### ${f.path}`, '```', body, '```')
    }
  }

  return parts.join('\n')
}

/** Contenido estático del workspace para Vertex context cache (archivos + memoria). */
export function buildWorkspaceStaticCacheContent(ctx: GeminiStreamContext): string {
  const parts: string[] = []
  if (ctx.memoryBlock?.trim()) parts.push(ctx.memoryBlock.trim())

  if (ctx.files?.length) {
    parts.push(
      '## Archivos del workspace (estado actual)',
      workspaceEditContextBlock(),
      '- El proyecto YA existe; conserva imports, rutas y componentes no relacionados con el pedido.',
    )
    const active = ctx.activePath
    const sorted = [...ctx.files].sort((a, b) => {
      if (a.path === active) return -1
      if (b.path === active) return 1
      return a.path.localeCompare(b.path)
    })
    for (const f of sorted.slice(0, MAX_FILES)) {
      const limit = f.path === active ? MAX_ACTIVE_FILE_CHARS : MAX_FILE_CHARS
      const body =
        f.content.length > limit
          ? `${f.content.slice(0, limit)}\n… (truncado)`
          : f.content
      parts.push('', `### ${f.path}`, '```', body, '```')
    }
  }

  if (ctx.code?.trim() && ctx.activePath) {
    const snippet =
      ctx.code.length > MAX_CODE_CHARS
        ? `${ctx.code.slice(0, MAX_CODE_CHARS)}\n\n… (truncado)`
        : ctx.code
    parts.push('', `## Archivo activo (${ctx.activePath})`, '```', snippet, '```')
  }

  return parts.join('\n')
}

function buildSystemInstruction(useSpecKit: boolean, framework?: string, targetPlatforms?: string[]): string {
  return (
    (useSpecKit
      ? 'Eres un asistente de desarrollo web experto (metodología Spec-Kit). '
      : 'Eres un asistente de desarrollo web experto. ') +
    'Sé conciso en prosa y preciso en código. ' +
    'Los archivos en "## Archivos del workspace" son el ESTADO ACTUAL del proyecto. ' +
    workspaceEditContextBlock() + ' ' +
    'Aplica el cambio pedido y conserva intacto lo no relacionado (imports, componentes, estilos y funciones ajenos al pedido). ' +
    'NUNCA sustituyas la app por otra distinta ni un scaffold genérico si el workspace ya tiene archivos, salvo petición explícita. ' +
    'Devuelve los archivos que cambien, cada uno con el contenido completo y final que sobrescribe el archivo existente ' +
    '(sin "// resto igual" ni fragmentos incompletos), en un bloque markdown con la ruta en la primera línea del fence. ' +
    'Si el usuario pide UI (formulario, botón, lista, etc.), debe verse en el preview: implementa JSX/CSS reales, no texto de estado. ' +
    'Nunca añadas footer, enlaces ni páginas de privacidad o términos legales salvo petición explícita del usuario. ' +
    exportableContextBlock({ framework, targetPlatforms })
  )
}

// --- Vertex AI Agent Platform (Google / Anthropic / OpenAI MaaS) ---

/** Gemini multimodal: publishers/google con imágenes inline. */
async function streamGoogleWithImages(
  prompt: string,
  systemInstruction: string,
  images: GeminiImagePart[] | undefined,
  modelId: string,
  thinkingLevel: string | undefined,
  send: SSESend,
  ctx: GeminiStreamContext,
): Promise<{ text: string; usage: TokenUsage }> {
  const route = resolveVertexModelRoute(modelId)
  const token = await getVertexBearerToken()
  const url = buildVertexPublisherUrl(
    { ...route, apiModelId: toVertexModelId(modelId) },
    'streamGenerateContent',
  )

  const userParts: Array<Record<string, unknown>> = []
  if (images?.length) {
    for (const img of images.slice(0, MAX_CHAT_IMAGES)) {
      userParts.push({ inlineData: { mimeType: img.mimeType, data: img.data } })
    }
  }
  userParts.push({ text: prompt })

  const body: Record<string, unknown> = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: 'user', parts: userParts }],
  }

  if (thinkingLevel) {
    body.generationConfig = {
      thinkingConfig: {
        thinkingBudget: thinkingLevel === 'high' ? 8192 : thinkingLevel === 'medium' ? 2048 : 512,
      },
    }
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Vertex Agent Platform error ${res.status}: ${errText}`)
  }

  const responseText = await res.text()
  let fullText = ''
  let usage = usageFromGeminiResponseText(responseText)

  try {
    const chunks = JSON.parse(responseText) as Array<{
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }>
    for (const chunk of chunks) {
      const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      if (!text) continue
      const prevText = fullText
      fullText += text
      send('token', text)
      emitNewlyCompletedFileDeltas(prevText, fullText, ctx, send)
      const chunkUsage = usageFromGeminiChunk(chunk)
      if (chunkUsage) usage = chunkUsage
    }
  } catch {
    const prevText = fullText
    fullText = responseText
    send('token', responseText)
    emitNewlyCompletedFileDeltas(prevText, fullText, ctx, send)
  }

  return { text: fullText, usage }
}

const OCR_SYSTEM_INSTRUCTION =
  'Eres un analista visual para desarrollo web. Describe con precisión textos visibles, layout, componentes UI, colores y detalles útiles para implementar o modificar código. Responde solo con el análisis en markdown, sin generar código de implementación.'

const noopSend: SSESend = () => {}

async function runOcrVisualAnalysis(
  userPrompt: string,
  images: GeminiImagePart[],
  ocrModelId: string,
  thinkingLevel: GeminiStreamContext['thinkingLevel'],
): Promise<{ analysis: string; usage: TokenUsage }> {
  const summary =
    userPrompt.length > 2000 ? `${userPrompt.slice(0, 2000)}…` : userPrompt
  const ocrPrompt = [
    'El usuario adjuntó capturas o referencias visuales para una tarea de desarrollo.',
    '',
    `Pedido del usuario (resumen): ${summary}`,
    '',
    'Analiza las imágenes: textos, estructura UI, componentes, estilos y cualquier detalle relevante para generar o editar código.',
  ].join('\n')

  const publisher = resolveVertexPublisher(ocrModelId)
  if (publisher === 'google') {
    const out = await streamGoogleWithImages(
      ocrPrompt,
      OCR_SYSTEM_INSTRUCTION,
      images,
      ocrModelId,
      thinkingLevel,
      noopSend,
      {},
    )
    return { analysis: out.text.trim(), usage: out.usage }
  }

  const out = await streamAgentPlatformText({
    prompt: ocrPrompt,
    systemInstruction: OCR_SYSTEM_INSTRUCTION,
    modelId: ocrModelId,
    thinkingLevel,
    images,
  })
  return { analysis: out.text.trim(), usage: out.usage }
}

export async function streamGeminiAgent(
  command: AICommand,
  ctx: GeminiStreamContext,
  send: SSESend,
  modelId: string,
): Promise<{ model: string; fullText: string; usage: TokenUsage }> {
  const useSpecKit = ctx.useSpecKit === true
  const systemInstruction = buildSystemInstruction(useSpecKit, ctx.framework, ctx.targetPlatforms)
  const prompt = buildGeminiPrompt(command, ctx)

  const vertexCreds = getVertexAICredentials()
  if (!vertexCreds) {
    throw new Error(
      'Vertex AI Agent Platform no configurado. Define GOOGLE_APPLICATION_CREDENTIALS o GOOGLE_CLOUD_* en .env.local',
    )
  }

  const hasImages = Boolean(ctx.images?.length)
  const resolved = ctx.resolvedCategoryModels
  const ocrThenCode =
    hasImages &&
    resolved &&
    shouldRunOcrThenCodePipeline(true, resolved)

  let promptForMain = prompt
  let mainModelId = modelId
  let usage = emptyTokenUsage()

  if (ocrThenCode && ctx.images?.length) {
    const { analysis, usage: ocrUsage } = await runOcrVisualAnalysis(
      prompt,
      ctx.images,
      resolved!.image,
      ctx.thinkingLevel,
    )
    usage = mergeTokenUsage(usage, ocrUsage)
    if (analysis) {
      promptForMain = `${prompt}\n\n## Análisis visual (OCR)\n\n${analysis}`
    }
    mainModelId = resolved!.code
  }

  const publisher = resolveVertexPublisher(mainModelId)
  const streamImages = ocrThenCode ? undefined : ctx.images

  let fullText: string
  if (publisher === 'google' && hasImages && !ocrThenCode) {
    const out = await streamGoogleWithImages(
      promptForMain,
      systemInstruction,
      streamImages,
      mainModelId,
      ctx.thinkingLevel,
      send,
      ctx,
    )
    fullText = out.text
    usage = mergeTokenUsage(usage, out.usage)
  } else {
    let cachedContent: string | null = null
    if (publisher === 'google' && modelSupportsCaching(mainModelId)) {
      const staticContent = buildWorkspaceStaticCacheContent(ctx)
      if (staticContent.trim()) {
        try {
          cachedContent = await getOrCreateCache({
            credentials: {
              projectId: vertexCreds.projectId,
              location: vertexCreds.location,
              clientEmail: vertexCreds.clientEmail,
              privateKey: vertexCreds.privateKey,
            },
            modelId: toVertexModelId(mainModelId),
            systemInstruction,
            staticContent,
          })
        } catch (e) {
          console.warn('[geminiStream] context cache skipped:', e)
        }
      }
    }

    let acc = ''
    const out = await streamAgentPlatformText({
      prompt: promptForMain,
      systemInstruction: cachedContent ? '' : systemInstruction,
      modelId: mainModelId,
      thinkingLevel: ctx.thinkingLevel,
      cachedContent,
      images: streamImages,
      onToken: (tok) => {
        const prev = acc
        acc += tok
        send('token', tok)
        emitNewlyCompletedFileDeltas(prev, acc, ctx, send)
      },
    })
    fullText = out.text
    usage = mergeTokenUsage(usage, out.usage)
  }

  emitFileUpdatesFromText(fullText, ctx, send)
  return { model: mainModelId, fullText, usage }
}
