import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import { NotificationDeliveryService } from '../notifications/notification-delivery.service'
import { buildContactEmail } from './contact.mail'
import type { SubmitContactDto } from './contact.dto'

@Injectable()
export class ContactService {
  constructor(private delivery: NotificationDeliveryService) {}

  async submit(dto: SubmitContactDto) {
    if (dto.company?.trim()) return { ok: true as const }

    const mail = buildContactEmail({
      name: dto.name,
      email: dto.email,
      reason: dto.reason,
      message: dto.message,
    })

    try {
      await this.delivery.sendContactEmail({
        replyTo: dto.email,
        subject: mail.subject,
        html: mail.html,
      })
    } catch {
      throw new ServiceUnavailableException('Could not send that message. Try again or email us.')
    }

    return { ok: true as const }
  }
}
