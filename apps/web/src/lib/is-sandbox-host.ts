/** Hostnames that run the public testing sandbox, not production. */
export function isSandboxHost(raw: string | null | undefined): boolean {
  if (!raw) return false
  const host = raw.split(',')[0]?.trim().split(':')[0]?.toLowerCase() ?? ''
  return host === 'test.djanora.com' || host === 'test.djanoro.com'
}
