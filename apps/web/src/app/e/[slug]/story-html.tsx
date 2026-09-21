const RICH_TAGS = new Set([
  'p',
  'br',
  'div',
  'span',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'h2',
  'h3',
  'h4',
  'blockquote',
  'a',
])

function safeHref(raw: string) {
  const href = raw
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
  if (!href) return null
  const lower = href.toLowerCase()
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('//')
  ) {
    return null
  }
  if (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:') ||
    lower.startsWith('#') ||
    lower.startsWith('/')
  ) {
    return href
  }
  return null
}

export function sanitizeRichText(raw: string, max: number) {
  let html = String(raw ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<textarea[\s\S]*?<\/textarea>/gi, '')

  html = html.replace(
    /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g,
    (full, tag: string, attrs: string) => {
      const name = tag.toLowerCase()
      const closing = full.startsWith('</')
      if (!RICH_TAGS.has(name)) return ''
      if (closing) return name === 'br' ? '' : `</${name}>`
      if (name === 'br') return '<br>'
      if (name === 'a') {
        const hrefMatch = attrs.match(/\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i)
        const rawHref = hrefMatch ? (hrefMatch[2] ?? hrefMatch[3] ?? hrefMatch[4] ?? '') : ''
        const href = safeHref(rawHref)
        return href
          ? `<a href="${href.replace(/"/g, '&quot;')}" rel="noopener noreferrer" target="_blank">`
          : '<a>'
      }
      return `<${name}>`
    },
  )

  return html.slice(0, max)
}

export function storyPlainText(html: string) {
  return sanitizeRichText(html, 8000)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeHtml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function storyToEditorHtml(raw: string) {
  const value = raw ?? ''
  if (!value.trim()) return ''
  if (/<\/?[a-z][\s\S]*>/i.test(value)) return sanitizeRichText(value, 8000)
  return value
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

export const STORY_PROSE_CLASS =
  'text-sm leading-relaxed [&_p]:mb-3 [&_p:last-child]:mb-0 [&_h2]:mb-2 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:[font-family:var(--site-heading,inherit)] [&_h3]:mb-2 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:[font-family:var(--site-heading,inherit)] [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_a]:underline [&_a]:[color:var(--site-accent,inherit)]'

export function StoryHtml({ html, emptyLabel }: { html?: string; emptyLabel?: string }) {
  const source = html ?? ''
  const clean = sanitizeRichText(source, 8000)
  if (!storyPlainText(clean)) {
    return emptyLabel ? <p className="text-sm leading-relaxed">{emptyLabel}</p> : null
  }
  if (!/<\/?[a-z][\s\S]*>/i.test(source)) {
    return <p className="text-sm leading-relaxed whitespace-pre-wrap">{source}</p>
  }
  return <div className={STORY_PROSE_CLASS} dangerouslySetInnerHTML={{ __html: clean }} />
}
