import { validate } from 'class-validator'
import { plainToInstance } from 'class-transformer'
import { SubmitContactDto } from './contact.dto'
import { buildContactEmail, escapeHtml } from './contact.mail'

describe('contact.mail', () => {
  it('escapes user text in the inbox email', () => {
    const mail = buildContactEmail({
      name: '<script>alert(1)</script>',
      email: 'host@example.com',
      reason: 'vendor_review',
      message: 'Need help with <b>review</b>',
    })
    expect(mail.subject).toBe('[Djanora] Vendor review — host@example.com')
    expect(mail.html).toContain(escapeHtml('<script>alert(1)</script>'))
    expect(mail.html).toContain(escapeHtml('Need help with <b>review</b>'))
    expect(mail.html).not.toContain('<script>')
    expect(mail.html).not.toContain('<b>review</b>')
  })
})

describe('SubmitContactDto', () => {
  it('accepts a valid message and rejects short or unknown reasons', async () => {
    const ok = plainToInstance(SubmitContactDto, {
      email: 'host@example.com',
      reason: 'general',
      message: 'I need help with my event.',
    })
    expect(await validate(ok)).toHaveLength(0)

    const bad = plainToInstance(SubmitContactDto, {
      email: 'not-an-email',
      reason: 'refund',
      message: 'short',
    })
    expect(await validate(bad)).not.toHaveLength(0)
  })
})
