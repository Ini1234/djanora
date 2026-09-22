import { cn } from '@/lib/utils'

export function DjanMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'font-display inline-flex shrink-0 items-center justify-center rounded-lg font-bold',
        className,
      )}
      style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
      aria-hidden="true"
    >
      D
    </span>
  )
}

/** Letter mark that follows nav icon color (not a chat bubble). */
export function DjanNavIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        'font-display inline-flex items-center justify-center leading-none font-bold',
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.72) }}
      aria-hidden="true"
    >
      D
    </span>
  )
}
