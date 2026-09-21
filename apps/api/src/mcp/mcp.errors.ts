import { HttpException } from '@nestjs/common'

export type McpErrorCode =
  | 'unauthorized'
  | 'not_found'
  | 'forbidden'
  | 'invalid'
  | 'conflict'
  | 'needs_confirm'
  | 'needs_event'
  | 'rate_limited'
  | 'unavailable'

export type McpErrorBody = {
  code: McpErrorCode
  message: string
  details?: unknown
}

export class McpJobError extends Error {
  constructor(readonly body: McpErrorBody) {
    super(body.message)
    this.name = 'McpJobError'
  }
}

export function mcpError(code: McpErrorCode, message: string, details?: unknown): never {
  throw new McpJobError({ code, message, details })
}

function nestMessage(exception: HttpException): string {
  const res = exception.getResponse()
  if (typeof res === 'string') return res
  if (typeof res === 'object' && res && 'message' in res) {
    const msg = res.message
    if (typeof msg === 'string') return msg
    if (Array.isArray(msg)) return msg.map(String).join('; ')
  }
  return exception.message
}

export function nestToMcp(err: unknown): McpErrorBody {
  if (err instanceof McpJobError) return err.body
  if (err instanceof HttpException) {
    const message = nestMessage(err)
    const byStatus: Record<number, McpErrorCode> = {
      401: 'unauthorized',
      403: 'forbidden',
      404: 'not_found',
      409: 'conflict',
      429: 'rate_limited',
      502: 'unavailable',
      503: 'unavailable',
    }
    return { code: byStatus[err.getStatus()] ?? 'invalid', message }
  }
  return {
    code: 'unavailable',
    message: err instanceof Error ? err.message : 'Something went wrong',
  }
}
