'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { proxyClient } from '@/lib/proxy-client'
import { DJAN_EVENT_REFRESH } from '@/components/assistant/djan-nav'
import { queryKeys } from '@/lib/query-keys'

export function useEventGet<T>(path: string | null) {
  const queryClient = useQueryClient()
  const key = queryKeys.eventSlice(path ?? '')

  useEffect(() => {
    if (!path) return
    const onRefresh = () => {
      void queryClient.invalidateQueries({ queryKey: key })
    }
    window.addEventListener(DJAN_EVENT_REFRESH, onRefresh)
    return () => window.removeEventListener(DJAN_EVENT_REFRESH, onRefresh)
  }, [path, queryClient, key])

  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data } = await proxyClient.get<T>(path!)
      return data
    },
    enabled: !!path,
  })

  return {
    data: q.data,
    setData: (next: T | ((prev: T | undefined) => T)) => {
      queryClient.setQueryData(key, next)
    },
    loading: !!path && q.isPending,
    error: q.isError,
  }
}
