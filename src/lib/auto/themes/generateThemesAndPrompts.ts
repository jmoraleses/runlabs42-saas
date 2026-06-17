import 'server-only'

import { isGeminiEnabled } from '@/lib/ai/config.server'
import { generateAgentPlatformText } from '@/lib/ai/vertexAgentPlatform'
import { defaultEcommerceScreenPrompts } from '@/lib/auto/defaultScreens'
import type { AutoScreenPrompt } from '@/lib/auto/types'

export type AutoTheme = {
  id: string
  name: string
  styleBrief: string
}

export type ThemesAndPromptsResult = {
  themes: AutoTheme[]
  selectedTheme: AutoTheme
  screenPrompts: AutoScreenPrompt[]
}

function sanitizeProjectTitle(raw: string, niche: string): string {
  const base = raw.replace(/["'`]/g, '').replace(/\s+/g, ' ').trim()
  if (!base) return `Auto ${niche.slice(0, 42).trim() || 'Store'}`
  return base.slice(0, 60)
}

function pickRandomTheme(themes: AutoTheme[]): AutoTheme {
  const idx = Math.floor(Math.random() * themes.length)
  return themes[idx] ?? themes[0]!
}

function withThemeStyle(prompt: string, theme: AutoTheme): string {
  const style = `Use this visual style consistently across the full website: ${theme.styleBrief}`
  if (prompt.includes(style)) return prompt
  return `${prompt.trim()} ${style}`.trim()
}

function fallbackThemes(niche: string): AutoTheme[] {
  return [
    {
      id: 'theme-modern-clean',
      name: 'Modern Clean',
      styleBrief: `Minimal ecommerce style for ${niche} with generous whitespace, strong CTA contrast and clear typography.`,
    },
    {
      id: 'theme-bold-editorial',
      name: 'Bold Editorial',
      styleBrief: `Editorial layout for ${niche} with expressive headlines, dynamic blocks and premium product focus.`,
    },
    {
      id: 'theme-tech-gradient',
      name: 'Tech Gradient',
      styleBrief: `Contemporary gradient-accent style for ${niche} with card-based sections and conversion-oriented hierarchy.`,
    },
  ]
}

function parseJsonCandidate(text: string): Record<string, unknown> | null {
  const raw = text.trim()
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? raw
  const start = fenced.indexOf('{')
  const end = fenced.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(fenced.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return null
  }
}

export async function generateThemesAndPrompts(opts: {
  niche: string
  selectedScreenIds?: string[]
}): Promise<ThemesAndPromptsResult> {
  const basePrompts = defaultEcommerceScreenPrompts(opts.niche)
  const selected = new Set(opts.selectedScreenIds?.filter(Boolean) ?? [])
  const filteredBase = selected.size
    ? basePrompts.filter((p) => selected.has(p.id))
    : basePrompts

  const fallbackThemeList = fallbackThemes(opts.niche)
  const fallbackSelectedTheme = pickRandomTheme(fallbackThemeList)
  const fallback: ThemesAndPromptsResult = {
    themes: fallbackThemeList,
    selectedTheme: fallbackSelectedTheme,
    screenPrompts: filteredBase.map((sp) => ({
      ...sp,
      prompt: withThemeStyle(sp.prompt, fallbackSelectedTheme),
    })),
  }

  if (!isGeminiEnabled()) return fallback

  try {
    const response = await generateAgentPlatformText(
      `Generate JSON for an ecommerce design workflow.
Niche: ${opts.niche}
Screen IDs: ${filteredBase.map((p) => p.id).join(', ')}

Return ONLY JSON:
{
  "themes": [{ "id": "theme-id", "name": "Theme Name", "styleBrief": "..." }],
  "selectedThemeId": "theme-id",
  "screenPrompts": [{ "id": "home", "name": "Inicio", "prompt": "English prompt for Stitch screen generation..." }]
}

Rules:
- exactly 3 themes
- pick one random theme id from the 3 themes and return it in selectedThemeId
- one prompt per requested screen id
- each prompt must be distinct and page-specific (no repeated or near-duplicate prompts)
- prompts must be in English, optimized for Google Stitch, and specific for conversion-focused ecommerce
- every screen prompt must align with the selected random theme's styleBrief.`,
      { responseMimeType: 'application/json', temperature: 0.45 },
    )

    const parsed = parseJsonCandidate(response)
    if (!parsed) return fallback

    const themes = Array.isArray(parsed.themes)
      ? parsed.themes
          .map((t) => {
            const row = t as Record<string, unknown>
            return {
              id: String(row.id ?? '').trim(),
              name: String(row.name ?? '').trim(),
              styleBrief: String(row.styleBrief ?? '').trim(),
            }
          })
          .filter((t) => t.id && t.name && t.styleBrief)
          .slice(0, 3)
      : []

    const promptMap = new Map(filteredBase.map((p) => [p.id, p]))
    const generatedPrompts = Array.isArray(parsed.screenPrompts)
      ? parsed.screenPrompts
          .map((p) => {
            const row = p as Record<string, unknown>
            const id = String(row.id ?? '').trim()
            if (!id || !promptMap.has(id)) return null
            const fallbackRow = promptMap.get(id)!
            return {
              id,
              name: String(row.name ?? fallbackRow.name).trim() || fallbackRow.name,
              prompt: String(row.prompt ?? fallbackRow.prompt).trim() || fallbackRow.prompt,
            }
          })
          .filter(Boolean) as AutoScreenPrompt[]
      : []

    if (!themes.length || !generatedPrompts.length) return fallback

    const selectedThemeId = String(parsed.selectedThemeId ?? '').trim()
    const selectedTheme = themes.find((t) => t.id === selectedThemeId) ?? pickRandomTheme(themes)

    const completePrompts = filteredBase.map((p) => {
      const match = generatedPrompts.find((g) => g.id === p.id) ?? p
      return { ...match, prompt: withThemeStyle(match.prompt, selectedTheme) }
    })

    return { themes, selectedTheme, screenPrompts: completePrompts }
  } catch {
    return fallback
  }
}

export async function generateAutoProjectTitle(opts: {
  niche: string
  selectedThemeName?: string
}): Promise<string> {
  const fallback = sanitizeProjectTitle(
    `${opts.selectedThemeName ? `${opts.selectedThemeName} ` : ''}${opts.niche} Store`,
    opts.niche,
  )
  if (!isGeminiEnabled()) return fallback
  try {
    const text = await generateAgentPlatformText(
      `Create one short descriptive ecommerce project title.
Niche: ${opts.niche}
Theme: ${opts.selectedThemeName ?? 'general'}
Rules:
- 3 to 7 words
- no punctuation at start/end
- brand-like but descriptive
- output only the title text`,
      { temperature: 0.4 },
    )
    return sanitizeProjectTitle(text, opts.niche)
  } catch {
    return fallback
  }
}

