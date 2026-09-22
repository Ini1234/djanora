import { createHash, randomBytes } from 'node:crypto'

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value))
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sortValue(v)]),
    )
  }
  return value
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

export function newConfirmToken(): string {
  return randomBytes(32).toString('base64url')
}

export function payloadHash(toolName: string, args: Record<string, unknown>): string {
  const rest = { ...args }
  delete rest.confirm_token
  return sha256Hex(`${toolName}:${canonicalJson(rest)}`)
}
