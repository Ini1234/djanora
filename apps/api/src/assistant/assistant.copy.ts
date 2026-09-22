import type { McpErrorCode } from '../mcp/mcp.errors'

const FAILURE_COPY: Record<McpErrorCode, string> = {
  already_done: "That's already done.",
  expired: 'That confirm expired. Ask me to preview again.',
  invalid: 'That confirm is no longer valid. Ask me to preview again.',
  unauthorized: 'Sign in again, then ask me to preview this.',
  forbidden: "You don't have access to do that.",
  not_found: "I couldn't find that.",
  conflict: "That conflicts with what's already there.",
  rate_limited: 'Too many requests. Try again in a minute.',
  unavailable: "I couldn't finish that.",
  needs_event: 'Which event should I use?',
  needs_confirm: 'That still needs a confirm tap.',
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function jobResultCode(result: unknown): string | null {
  if (!isRecord(result) || typeof result.code !== 'string') return null
  return result.code
}

export function isAlreadyDone(result: unknown) {
  return jobResultCode(result) === 'already_done'
}

export function isJobFailure(result: unknown) {
  const code = jobResultCode(result)
  return code !== null && code !== 'ok'
}

export function jobFailureCopy(code: string) {
  return FAILURE_COPY[code as McpErrorCode] ?? "I couldn't finish that."
}

export function importConfirmMessage(tool: string, result: unknown) {
  if (tool === 'draft_site_copy' && isRecord(result) && typeof result.created === 'number') {
    return `Drafted ${result.created} site section${result.created === 1 ? '' : 's'}. Not published.`
  }
  if (tool === 'apply_weekend' && isRecord(result) && typeof result.created === 'number') {
    const skipped =
      typeof result.skipped === 'number' && result.skipped > 0
        ? `, skipped ${result.skipped} already on the event`
        : ''
    return `Added ${result.created} ceremon${result.created === 1 ? 'y' : 'ies'}${skipped}.`
  }
  if (isRecord(result) && typeof result.created === 'number') {
    const skipped =
      typeof result.skipped === 'number' && result.skipped > 0
        ? `, skipped ${result.skipped} already on the event`
        : ''
    return `Added ${result.created}${skipped}`
  }
  return 'Done.'
}
