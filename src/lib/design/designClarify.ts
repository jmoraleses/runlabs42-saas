/** Preguntas de aclaración antes de generar diseño en Studio. */

export const MAX_DESIGN_CLARIFY_QUESTIONS = 5

export type DesignClarifyOption = {
  id: string
  label: string
}

export type DesignClarifyQuestion = {
  id: string
  question: string
  options: DesignClarifyOption[]
  /** Si true, el usuario puede marcar varias opciones. */
  allowMultiple?: boolean
}

export type DesignClarifyAnswer = {
  questionId: string
  /** ids de opciones seleccionadas */
  selectedOptionIds: string[]
  /** Texto libre cuando elige "otro" */
  otherText?: string
}

export type DesignClarifyResult = {
  questions: DesignClarifyQuestion[]
}

function slugId(prefix: string, index: number): string {
  return `${prefix}-${index + 1}`
}

function normalizeOptions(raw: unknown, questionIndex: number): DesignClarifyOption[] {
  if (!Array.isArray(raw)) return []
  const options: DesignClarifyOption[] = []
  for (let i = 0; i < raw.length && options.length < 8; i++) {
    const item = raw[i]
    if (typeof item === 'string') {
      const label = item.trim()
      if (label) options.push({ id: slugId('opt', i), label })
      continue
    }
    if (item && typeof item === 'object') {
      const rec = item as Record<string, unknown>
      const label = String(rec.label ?? rec.text ?? '').trim()
      if (!label) continue
      const id = String(rec.id ?? '').trim() || slugId('opt', i)
      options.push({ id, label })
    }
  }
  return options
}

/** Parsea la respuesta del modelo (JSON o bloque ```json). */
export function parseDesignClarifyJson(text: string): DesignClarifyResult {
  const raw = text.trim()
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const candidate = (fence ?? raw).trim()
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) return { questions: [] }

  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>
    const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : []
    const questions: DesignClarifyQuestion[] = []

    for (let qi = 0; qi < rawQuestions.length && questions.length < MAX_DESIGN_CLARIFY_QUESTIONS; qi++) {
      const q = rawQuestions[qi]
      if (!q || typeof q !== 'object') continue
      const rec = q as Record<string, unknown>
      const question = String(rec.question ?? rec.text ?? '').trim()
      if (!question) continue
      const options = normalizeOptions(rec.options, qi)
      if (options.length < 2) continue
      const id = String(rec.id ?? '').trim() || slugId('q', qi)
      questions.push({
        id,
        question,
        options,
        allowMultiple: Boolean(rec.allowMultiple ?? rec.multiple),
      })
    }

    return { questions }
  } catch {
    return { questions: [] }
  }
}

/** Bloque añadido al prompt tras las respuestas del usuario. */
export function formatClarificationPromptBlock(
  answers: DesignClarifyAnswer[],
  questions: DesignClarifyQuestion[],
): string {
  if (!answers.length || !questions.length) return ''

  const byId = new Map(questions.map((q) => [q.id, q]))
  const lines: string[] = ['## Aclaraciones del usuario (obligatorio para el diseño)']

  for (const answer of answers) {
    const q = byId.get(answer.questionId)
    if (!q) continue
    const labels = answer.selectedOptionIds
      .map((oid) => q.options.find((o) => o.id === oid)?.label)
      .filter(Boolean) as string[]
    const other = answer.otherText?.trim()
    if (other) labels.push(other)
    if (!labels.length) continue
    lines.push(`- **${q.question}** ${labels.join('; ')}`)
  }

  return lines.length > 1 ? lines.join('\n') : ''
}

/** Si el prompt ya es muy detallado, se puede omitir aclaración (heurística cliente). */
export function shouldSkipDesignClarifyHeuristic(prompt: string): boolean {
  const trimmed = prompt.trim()
  if (trimmed.length < 12) return false
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length
  if (wordCount >= 80) return true
  const hasStructure =
    /\n\s*[-*•]\s/m.test(trimmed) ||
    /\b(debe|necesito|incluir|pantallas?|usuarios?|admin|login|filtros?|carrito)\b/i.test(
      trimmed,
    )
  return wordCount >= 45 && hasStructure
}
