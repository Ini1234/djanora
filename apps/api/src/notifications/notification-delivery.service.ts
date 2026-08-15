import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Resend } from 'resend'
import Twilio from 'twilio'

@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name)
  private resend: Resend
  private twilioClient: ReturnType<typeof Twilio> | null = null
  private readonly twilioFrom: string

  constructor(private config: ConfigService) {
    this.resend = new Resend(this.config.get<string>('RESEND_API_KEY'))

    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID') ?? ''
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN') ?? ''
    this.twilioFrom = this.config.get<string>('TWILIO_PHONE_NUMBER') ?? ''

    // Only initialise Twilio when real credentials are present
    if (sid && !sid.startsWith('ACyour')) {
      try {
        this.twilioClient = Twilio(sid, token)
      } catch {
        this.logger.warn('Twilio credentials invalid — SMS delivery disabled')
      }
    }
  }

  async sendEmail(opts: {
    to: string
    subject: string
    html: string
  }): Promise<void> {
    const from = this.config.get<string>('RESEND_FROM_EMAIL') ?? 'onboarding@resend.dev'
    try {
      await this.resend.emails.send({ from, to: opts.to, subject: opts.subject, html: opts.html })
      this.logger.log(`Email sent to ${opts.to}: ${opts.subject}`)
    } catch (err) {
      this.logger.error(`Failed to send email to ${opts.to}`, err)
    }
  }

  async sendSms(opts: { to: string; body: string }): Promise<void> {
    if (!this.twilioClient) {
      this.logger.warn(`SMS skipped (no Twilio credentials) — would have sent to ${opts.to}`)
      return
    }
    try {
      await this.twilioClient.messages.create({
        from: this.twilioFrom,
        to: opts.to,
        body: opts.body,
      })
      this.logger.log(`SMS sent to ${opts.to}`)
    } catch (err) {
      this.logger.error(`Failed to send SMS to ${opts.to}`, err)
    }
  }

  buildChecklistReminderEmail(opts: {
    firstName: string | null
    eventTitle: string
    itemTitle: string
    dueDate: string
  }): string {
    const name = opts.firstName ?? 'there'
    return `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#1a3a2a;margin-bottom:4px">Checklist Reminder</h2>
        <p style="color:#3d7a52;margin-top:0">for <strong>${opts.eventTitle}</strong></p>
        <p>Hi ${name},</p>
        <p>Just a reminder that the following checklist item is due <strong>${opts.dueDate}</strong>:</p>
        <div style="background:#f1faf4;border-left:4px solid #c9973a;padding:12px 16px;border-radius:4px;margin:16px 0">
          <strong style="color:#1a3a2a">${opts.itemTitle}</strong>
        </div>
        <p>Log in to mark it complete or update the due date.</p>
        <a href="${process.env.WEB_URL ?? 'http://localhost:3000'}/events"
           style="display:inline-block;background:#c9973a;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">
          View My Events
        </a>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px">
          You're receiving this because you enabled email reminders for this checklist item.
        </p>
      </div>
    `
  }
}
