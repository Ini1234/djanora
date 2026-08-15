'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { proxyClient } from '@/lib/proxy-client'

export function useModeSwitch(activeMode: string) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const isVendorMode = activeMode === 'vendor'

  async function switchMode() {
    if (pending) return
    setPending(true)
    const next = isVendorMode ? 'user' : 'vendor'
    try {
      await proxyClient.patch('/users/me/mode', { mode: next })
      router.push(next === 'vendor' ? '/vendor/dashboard' : '/')
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return { isVendorMode, pending, switchMode }
}
