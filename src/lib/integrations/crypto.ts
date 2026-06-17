import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const PREFIX = 'rl42:v1:'

function deriveKey(): Buffer {
  const secret = process.env.INTEGRATIONS_ENCRYPTION_KEY?.trim()
  if (!secret || secret.length < 16) {
    throw new Error(
      'INTEGRATIONS_ENCRYPTION_KEY requerida (mín. 16 caracteres) para cifrar integraciones.',
    )
  }
  return scryptSync(secret, 'integrations-encryption-v1', 32)
}

export function encryptSecret(plaintext: string): string {
  const key = deriveKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return PREFIX + Buffer.concat([iv, tag, enc]).toString('base64url')
}

export function decryptSecret(payload: string): string {
  if (!payload.startsWith(PREFIX)) {
    throw new Error('Formato de secreto inválido')
  }
  const raw = Buffer.from(payload.slice(PREFIX.length), 'base64url')
  const iv = raw.subarray(0, 12)
  const tag = raw.subarray(12, 28)
  const enc = raw.subarray(28)
  const key = deriveKey()
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}
