'use client'

import React from 'react'

type ComposerToolButtonProps = {
  label: string
  active?: boolean
  disabled?: boolean
  onClick?: () => void
  children: React.ReactNode
}

export function ComposerToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: ComposerToolButtonProps) {
  return (
    <button
      type="button"
      className={`composer-tool-btn${active ? ' is-active' : ''}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
