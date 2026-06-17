'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

type ModalProps = {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
  panelClassName?: string
  labelledBy?: string
}

export function Modal({
  open,
  onClose,
  children,
  className,
  panelClassName,
  labelledBy,
}: ModalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!mounted || !open) return null

  return createPortal(
    <div
      className={['modal-backdrop', className].filter(Boolean).join(' ')}
      role="presentation"
      onClick={onClose}
    >
      <div
        className={['modal-panel', panelClassName].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
