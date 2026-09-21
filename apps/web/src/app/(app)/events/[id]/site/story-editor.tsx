'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { Bold, Heading2, Italic, Link2, List, ListOrdered, Underline } from 'lucide-react'
import {
  STORY_PROSE_CLASS,
  sanitizeRichText,
  storyPlainText,
  storyToEditorHtml,
} from '@/app/e/[slug]/story-html'

const MAX = 8000

const fieldStyle = {
  background: 'var(--color-card)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text-primary)',
} as const

function ToolButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="rounded-md p-1.5"
      style={{ color: 'var(--color-text-primary)' }}
    >
      {children}
    </button>
  )
}

export function StoryEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (html: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const focused = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el || focused.current) return
    const next = storyToEditorHtml(value)
    if (el.innerHTML !== next) el.innerHTML = next
  }, [value])

  function emit() {
    onChange(sanitizeRichText(ref.current?.innerHTML ?? '', MAX))
  }

  function command(cmd: string, arg?: string) {
    ref.current?.focus()
    document.execCommand(cmd, false, arg)
    emit()
  }

  function addLink() {
    const url = window.prompt('Link URL', 'https://')
    if (!url) return
    command('createLink', url)
  }

  function heading() {
    ref.current?.focus()
    if (!document.execCommand('formatBlock', false, 'h2')) {
      document.execCommand('formatBlock', false, '<h2>')
    }
    emit()
  }

  const empty = !storyPlainText(value)

  return (
    <div className="overflow-hidden rounded-xl" style={fieldStyle}>
      <div
        className="flex flex-wrap items-center gap-0.5 border-b px-1 py-1"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <ToolButton label="Bold" onClick={() => command('bold')}>
          <Bold size={14} />
        </ToolButton>
        <ToolButton label="Italic" onClick={() => command('italic')}>
          <Italic size={14} />
        </ToolButton>
        <ToolButton label="Underline" onClick={() => command('underline')}>
          <Underline size={14} />
        </ToolButton>
        <ToolButton label="Heading" onClick={heading}>
          <Heading2 size={14} />
        </ToolButton>
        <ToolButton label="Bulleted list" onClick={() => command('insertUnorderedList')}>
          <List size={14} />
        </ToolButton>
        <ToolButton label="Numbered list" onClick={() => command('insertOrderedList')}>
          <ListOrdered size={14} />
        </ToolButton>
        <ToolButton label="Link" onClick={addLink}>
          <Link2 size={14} />
        </ToolButton>
      </div>
      <div className="relative">
        {empty && (
          <p
            className="pointer-events-none absolute top-2 left-3 text-sm"
            style={{ color: 'var(--color-muted)' }}
          >
            Write your story
          </p>
        )}
        <div
          ref={ref}
          contentEditable
          role="textbox"
          aria-label="Story"
          aria-multiline
          suppressContentEditableWarning
          className={`min-h-48 px-3 py-2 focus:outline-none ${STORY_PROSE_CLASS}`}
          onFocus={() => {
            focused.current = true
          }}
          onBlur={() => {
            focused.current = false
            emit()
          }}
          onInput={emit}
          onPaste={(e) => {
            e.preventDefault()
            const pasted =
              e.clipboardData.getData('text/html') || e.clipboardData.getData('text/plain')
            document.execCommand('insertHTML', false, sanitizeRichText(pasted, MAX))
            emit()
          }}
        />
      </div>
    </div>
  )
}
