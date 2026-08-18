'use client'

import { useTheme } from '@/components/theme-provider'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useClientMounted } from '@/lib/use-synced-state'
import { cn } from '@/lib/utils'

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme()
  const mounted = useClientMounted()
  if (!mounted) return <div className="h-8 w-8" />

  const options = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
  ] as const

  if (compact) {
    const next = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark'
    const Current = options.find((o) => o.value === theme)?.icon ?? Monitor
    return (
      <button
        type="button"
        onClick={() => setTheme(next)}
        aria-label={`Switch theme (current: ${theme})`}
        className="text-brand-400 hover:text-brand-200 light:hover:bg-black/6 rounded-lg p-1.5 transition-colors hover:bg-white/6 dark:hover:bg-white/6"
      >
        <Current size={15} aria-hidden="true" />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-black/10 bg-black/5 p-0.5 dark:border-white/10 dark:bg-white/6">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          aria-label={`${label} theme`}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-all',
            theme === value
              ? 'bg-gold-600 text-brand-900 shadow-sm'
              : 'text-brand-500 hover:text-brand-800 dark:text-brand-400 dark:hover:text-brand-200',
          )}
        >
          <Icon size={11} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  )
}
