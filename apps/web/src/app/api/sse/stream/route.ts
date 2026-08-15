import { proxyNestStream } from '@/lib/proxy-nest'

export const dynamic = 'force-dynamic'

export async function GET() {
  return proxyNestStream('/sse/stream')
}
