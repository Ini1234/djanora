import 'server-only'

import { Readable } from 'node:stream'
import { NextRequest, NextResponse } from 'next/server'
import { isAxiosError } from 'axios'
import { getBackendClerkToken } from '@/lib/clerk-token'
import { backend } from '@/lib/backend'

/**
 * Forward a Next.js Route Handler request to Nest over axios.
 * `nestPath` is the path after `/api`, e.g. `/inquiries/${id}/messages`.
 */
export async function proxyNest(req: NextRequest, nestPath: string): Promise<NextResponse> {
  const token = await getBackendClerkToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const method = req.method.toUpperCase()
  const search = new URL(req.url).search
  const contentType = req.headers.get('content-type') ?? ''
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  }

  let data: unknown
  if (method !== 'GET' && method !== 'HEAD') {
    if (contentType.includes('multipart/form-data')) {
      data = await req.formData()
    } else {
      const text = await req.text()
      data = text || undefined
      headers['Content-Type'] = contentType || 'application/json'
    }
  }

  const isReceiptFile = /\/receipts\/[^/]+\/file\/?$/.test(nestPath)

  try {
    const res = await backend.request<string | ArrayBuffer>({
      url: `${nestPath}${search}`,
      method,
      headers,
      data,
      timeout: 60_000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      validateStatus: () => true,
      responseType: isReceiptFile ? 'arraybuffer' : 'text',
      transformResponse: [(body) => body],
    })

    const body = isReceiptFile
      ? Buffer.from(res.data as ArrayBuffer)
      : (res.data ?? '')
    const headersOut: Record<string, string> = {
      'Content-Type': String(res.headers['content-type'] ?? (isReceiptFile ? 'application/octet-stream' : 'application/json')),
    }
    if (res.headers['content-disposition']) {
      headersOut['Content-Disposition'] = String(res.headers['content-disposition'])
    }

    return new NextResponse(body, {
      status: res.status,
      headers: headersOut,
    })
  } catch (err) {
    if (isAxiosError(err) && err.response) {
      const body = typeof err.response.data === 'string'
        ? err.response.data
        : JSON.stringify(err.response.data ?? { error: 'Upstream error' })
      return new NextResponse(body, {
        status: err.response.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return NextResponse.json({ error: 'Upstream unavailable' }, { status: 502 })
  }
}

/** SSE proxy — axios stream piped to a Web Response. */
export async function proxyNestStream(nestPath: string): Promise<Response> {
  const token = await getBackendClerkToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const res = await backend.get(nestPath, {
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${token}`,
      },
      responseType: 'stream',
      timeout: 0,
      adapter: 'http',
    })

    const webStream = Readable.toWeb(res.data as Readable) as ReadableStream
    return new Response(webStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
        Connection: 'keep-alive',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Stream unavailable' }, { status: 503 })
  }
}
