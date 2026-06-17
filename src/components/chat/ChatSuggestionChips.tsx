'use client'

import React from 'react'

const CONTEXT_GROUPS = [
  {
    match: ['auth', 'login', 'register', 'session', 'usuario', 'password', 'contraseña'],
    chips: ['Añade recuperar contraseña', 'Añade roles de usuario', 'Mejora la seguridad'],
  },
  {
    match: ['dashboard', 'analytics', 'chart', 'gráfica', 'métricas', 'kpi'],
    chips: ['Añade más métricas', 'Añade filtros de fecha', 'Exporta a CSV'],
  },
  {
    match: ['game', 'juego', 'score', 'puntuación', 'nivel', 'snake', 'level'],
    chips: ['Añade más niveles', 'Mejora los efectos visuales', 'Añade tabla de puntuaciones'],
  },
  {
    match: ['landing', 'hero', 'pricing', 'precio', 'saas', 'testimonial'],
    chips: ['Añade testimonios', 'Mejora el CTA', 'Añade sección FAQ'],
  },
  {
    match: ['api', 'endpoint', 'rest', 'crud', 'backend', 'route', 'server'],
    chips: ['Añade autenticación JWT', 'Añade paginación', 'Genera documentación'],
  },
  {
    match: ['mobile', 'app', 'task', 'todo', 'lista', 'notes', 'notas'],
    chips: ['Añade modo oscuro', 'Añade notificaciones', 'Mejora la navegación'],
  },
]

const DEFAULT_CHIPS = ['Mejora el diseño', 'Añade más funciones', 'Hazlo responsive']

function getChips(lastResponse: string): string[] {
  const lower = lastResponse.toLowerCase()
  for (const group of CONTEXT_GROUPS) {
    if (group.match.some((kw) => lower.includes(kw))) return group.chips
  }
  return DEFAULT_CHIPS
}

type ChatSuggestionChipsProps = {
  lastResponse: string
  onSelect: (prompt: string) => void
}

export function ChatSuggestionChips({ lastResponse, onSelect }: ChatSuggestionChipsProps) {
  const chips = getChips(lastResponse)
  return (
    <div className="chat-suggestion-chips" role="list" aria-label="Sugerencias de seguimiento">
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          role="listitem"
          className="chat-suggestion-chip"
          onClick={() => onSelect(chip)}
        >
          {chip}
        </button>
      ))}
    </div>
  )
}
