/**
 * Copy text with Clipboard API first, then a hidden textarea fallback.
 * Safari and some Android WebViews reject clipboard.writeText without a
 * secure context or a user gesture; they still accept the selection fallback.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through */
  }

  try {
    const field = document.createElement('textarea')
    field.value = text
    field.setAttribute('readonly', '')
    field.setAttribute('aria-hidden', 'true')
    field.style.position = 'fixed'
    field.style.top = '0'
    field.style.left = '0'
    field.style.width = '1px'
    field.style.height = '1px'
    field.style.opacity = '0'
    document.body.appendChild(field)
    field.focus()
    field.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(field)
    return ok
  } catch {
    return false
  }
}
