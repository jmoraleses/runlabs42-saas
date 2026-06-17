'use client'

import React from 'react'

type Props = { children: React.ReactNode }
type State = { hasError: boolean; message: string }

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '50vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 40,
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>Algo salió mal</h1>
          <p style={{ color: 'var(--text-mid)', marginBottom: 20, maxWidth: 400 }}>
            {this.state.message || 'Error inesperado en la aplicación.'}
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.location.assign('/')}
          >
            Volver al inicio
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
