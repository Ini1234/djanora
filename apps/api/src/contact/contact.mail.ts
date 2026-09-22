export const CONTACT_REASONS = ['general', 'vendor_review', 'account', 'bug', 'other'] as const
export type ContactReason = (typeof CONTACT_REASONS)[number]

export const CONTACT_REASON_LABELS: Record<ContactReason, string> = {
  general: 'General',
  vendor_review: 'Vendor review',
  account: 'Account',
  bug: 'Bug',
  other: 'Other',
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildContactEmail(input: {
  name?: string
  email: string
  reason: ContactReason
  message: string
}) {
  const reason = CONTACT_REASON_LABELS[input.reason]
  const name = input.name?.trim() || 'Someone'
  const subject = `[Djanora] ${reason} — ${input.email}`
  const html = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <h2 style="color:#1a3a2a;margin:0 0 8px">New contact message</h2>
        <p style="color:#3d7a52;margin:0 0 16px">${escapeHtml(reason)}</p>
        <p style="margin:0 0 8px"><strong>From:</strong> ${escapeHtml(name)}</p>
        <p style="margin:0 0 16px"><strong>Email:</strong> ${escapeHtml(input.email)}</p>
        <div style="background:#f1faf4;border-left:4px solid #c9973a;padding:12px 16px;border-radius:4px;white-space:pre-wrap">
          ${escapeHtml(input.message.trim())}
        </div>
      </div>
    `
  return { subject, html }
}
