'use client'

import { useState, useSyncExternalStore, type Dispatch, type SetStateAction } from 'react'

/** Local state that resets when `source` changes, without an effect. */
export function useSyncedState<T>(source: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState(source)
  const [prev, setPrev] = useState(source)
  if (!Object.is(source, prev)) {
    setPrev(source)
    setState(source)
  }
  return [state, setState]
}

/** Local state seeded by `initial`, replaced when a fetch/`remote` value arrives. */
export function useHydratedState<T>(
  remote: T | undefined,
  initial: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState(initial)
  const [prevRemote, setPrevRemote] = useState(remote)
  if (!Object.is(remote, prevRemote)) {
    setPrevRemote(remote)
    if (remote !== undefined) setState(remote)
  }
  return [state, setState]
}

/** True after hydration; false on the server. Avoids `setMounted(true)` in an effect. */
export function useClientMounted() {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  )
}
