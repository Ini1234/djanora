import { ServiceUnavailableException } from '@nestjs/common'
import { ContactService } from './contact.service'

describe('ContactService', () => {
  const delivery = { sendContactEmail: jest.fn() }
  const service = new ContactService(delivery as never)

  beforeEach(() => {
    jest.resetAllMocks()
    delivery.sendContactEmail.mockResolvedValue(undefined)
  })

  it('drops honeypot submissions without sending mail', async () => {
    await expect(
      service.submit({
        email: 'bot@example.com',
        reason: 'general',
        message: 'Buy cheap watches now',
        company: 'Acme SEO',
      }),
    ).resolves.toEqual({ ok: true })
    expect(delivery.sendContactEmail).not.toHaveBeenCalled()
  })

  it('sends a reply-to inbox email', async () => {
    await expect(
      service.submit({
        name: 'Amaka',
        email: 'amaka@example.com',
        reason: 'vendor_review',
        message: 'Why is my listing still pending?',
      }),
    ).resolves.toEqual({ ok: true })
    expect(delivery.sendContactEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        replyTo: 'amaka@example.com',
        subject: '[Djanora] Vendor review — amaka@example.com',
      }),
    )
  })

  it('surfaces a send failure', async () => {
    delivery.sendContactEmail.mockRejectedValue(new Error('resend down'))
    await expect(
      service.submit({
        email: 'amaka@example.com',
        reason: 'bug',
        message: 'The guests page will not load for me.',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException)
  })
})
