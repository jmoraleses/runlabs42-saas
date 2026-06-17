import { ApiError } from '@/lib/api/errors'

/** Parsea el cuerpo JSON de forma segura (evita 500 si viene vacío o truncado). */
export async function parseRequestJson<T = Record<string, unknown>>(
  request: Request,
): Promise<T> {
  const raw = await request.text()
  if (!raw.trim()) {
    throw new ApiError(400, 'Cuerpo de la petición vacío')
  }
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new ApiError(400, 'JSON inválido en el cuerpo de la petición')
  }
}
