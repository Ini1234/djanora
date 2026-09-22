export const CONTACT_EMAIL = 'contact@djanora.com'
export const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}`
export const CONTACT_PATH = '/contact'

export const CONTACT_REASONS = ['general', 'vendor_review', 'account', 'bug', 'other'] as const
export type ContactReason = (typeof CONTACT_REASONS)[number]

export function isContactReason(value: string | undefined | null): value is ContactReason {
  return !!value && (CONTACT_REASONS as readonly string[]).includes(value)
}

export function contactHref(reason?: ContactReason) {
  return reason ? `${CONTACT_PATH}?reason=${reason}` : CONTACT_PATH
}
