import { NextResponse } from 'next/server'
import { apiErrorFromVertexError } from '@/lib/ai/vertexErrors'
import { VisualAuditRequiredError } from '@/lib/design/visualAuditErrors'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function jsonError(error: unknown) {
  if (error instanceof VisualAuditRequiredError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 422 },
    )
  }
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, details: error.details },
      { status: error.status },
    )
  }
  const vertexErr = apiErrorFromVertexError(error)
  if (vertexErr) {
    console.warn(vertexErr.message)
    return NextResponse.json({ error: vertexErr.message }, { status: vertexErr.status })
  }
  console.error(error)
  const message =
    error instanceof Error && error.message
      ? error.message
      : 'Error interno del servidor'
  return NextResponse.json({ error: message }, { status: 500 })
}
