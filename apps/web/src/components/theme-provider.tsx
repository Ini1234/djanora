'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useServerInsertedHTML } from 'next/navigation'

export type Theme = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'theme'
const DEFAULT_THEME: Theme = 'dark'

const BOOTSTRAP = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}')||'${DEFAULT_THEME}';var r=t==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;var d=document.documentElement;d.classList.remove('light','dark');d.classList.add(r);d.style.colorScheme=r;}catch(e){}})();`

function systemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function apply(theme: Theme) {
  const resolved: ResolvedTheme = theme === 'system' ? systemTheme() : theme
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(resolved)
  root.style.colorScheme = resolved
  return resolved
}

type ThemeContextValue = {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  resolvedTheme: 'dark',
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('dark')

  useServerInsertedHTML(() => <script dangerouslySetInnerHTML={{ __html: BOOTSTRAP }} />)

  useEffect(() => {
    const stored = (window.localStorage.getItem(STORAGE_KEY) as Theme | null) ?? DEFAULT_THEME
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate theme from localStorage */
    setThemeState(stored)
    setResolvedTheme(apply(stored))
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setResolvedTheme(apply('system'))
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    window.localStorage.setItem(STORAGE_KEY, next)
    setThemeState(next)
    setResolvedTheme(apply(next))
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
