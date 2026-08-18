import { basename } from 'path'

const APP_FILE = /^post-[a-f0-9]{32}\.[a-z0-9]+$/i

export function storedUploadPath(filename: string) {
  return `uploads/${filename}`
}

export function publicApiBase(env: NodeJS.ProcessEnv = process.env) {
  const explicit = env.PUBLIC_API_URL?.trim()
  const azure = env.WEBSITE_HOSTNAME ? `https://${env.WEBSITE_HOSTNAME}` : ''
  const legacy = env.NEXT_PUBLIC_API_URL?.trim()
  let raw = explicit || azure || legacy || 'http://localhost:3001'
  raw = raw.replace(/\/$/, '')
  raw = raw.replace(/\/api$/i, '')
  return raw
}

export function rewriteAppUploadUrl(
  url: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null

  const pathOnly = trimmed.split('?')[0] ?? trimmed
  if (pathOnly.includes('/private/') || pathOnly.startsWith('private/')) return trimmed

  const filename = basename(pathOnly)
  const isStoredPath = pathOnly === `uploads/${filename}` || pathOnly.startsWith('uploads/')
  const hasUploadsSegment = /\/uploads\//.test(pathOnly) || pathOnly.startsWith('/uploads/')
  const looksLikeAppFile = APP_FILE.test(filename)

  if (!isStoredPath && !hasUploadsSegment && !looksLikeAppFile) return trimmed
  if (!filename || filename === '.' || filename === '..') return trimmed

  return `${publicApiBase(env)}/api/uploads/${filename}`
}
