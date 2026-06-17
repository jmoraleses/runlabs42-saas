'use client'

import React from 'react'
import { useApp } from '@/components/app/shell'

const CATEGORIES = [
  {
    icon: '🌐',
    label: 'Web App',
    prompt: 'Crea una web app con autenticación de usuarios, dashboard principal y diseño moderno con Tailwind.',
  },
  {
    icon: '🚀',
    label: 'Landing page',
    prompt: 'Diseña una landing page atractiva para un SaaS con hero, features, precios y CTA.',
  },
  {
    icon: '📊',
    label: 'Dashboard',
    prompt: 'Construye un dashboard de analíticas con gráficas de líneas, tarjetas de métricas y tabla de datos.',
  },
  {
    icon: '🎮',
    label: 'Juego',
    prompt: 'Crea un juego en el navegador: Snake clásico con puntuación, niveles y efectos visuales.',
  },
  {
    icon: '📱',
    label: 'App móvil',
    prompt: 'Diseña una app estilo móvil de lista de tareas con categorías, prioridades y modo oscuro.',
  },
  {
    icon: '⚡',
    label: 'API / Backend',
    prompt: 'Crea una API REST con endpoints de autenticación, CRUD de usuarios y documentación integrada.',
  },
] as const

type ChatEmptyStateProps = {
  onSelectPrompt: (prompt: string) => void
}

export function ChatEmptyState({ onSelectPrompt }: ChatEmptyStateProps) {
  const { t } = useApp() as { t: (key: string) => string }

  return (
    <div className="chat-empty-state">
      <div className="chat-empty-logo" aria-hidden>
        <span className="chat-empty-logo__42">42</span>
      </div>
      <p className="chat-empty-headline">{t('chat.empty.headline')}</p>
      <p className="chat-empty-sub">{t('chat.empty.sub')}</p>
      <div className="chat-empty-grid" role="list">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.label}
            type="button"
            role="listitem"
            className="chat-empty-card"
            onClick={() => onSelectPrompt(cat.prompt)}
          >
            <span className="chat-empty-card__icon" aria-hidden>{cat.icon}</span>
            <span className="chat-empty-card__label">{cat.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
