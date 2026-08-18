'use client'

import { useEffect, useState } from 'react'
import { proxyClient } from '@/lib/proxy-client'

export function useLazyGet<T>(path: string | null) {
  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState(false)
  const [resolvedPath, setResolvedPath] = useState<string | null>(null)

  useEffect(() => {
    if (!path) return
    let cancelled = false
    proxyClient
      .get<T>(path)
      .then(({ data: next }) => {
        if (cancelled) return
        setData(next)
        setError(false)
        setResolvedPath(path)
      })
      .catch(() => {
        if (cancelled) return
        setError(true)
        setResolvedPath(path)
      })
    return () => {
      cancelled = true
    }
  }, [path])

  return {
    data: resolvedPath === path ? data : undefined,
    setData,
    loading: !!path && resolvedPath !== path,
    error: resolvedPath === path && error,
  }
}
