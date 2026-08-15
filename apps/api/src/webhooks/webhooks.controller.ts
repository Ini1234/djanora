import {
  Controller,
  Post,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { verifyWebhook } from '@clerk/backend/webhooks'
import { UsersService } from '../users/users.service'

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name)

  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  @Post('clerk')
  @HttpCode(HttpStatus.OK)
  async handleClerkWebhook(@Req() req: { rawBody?: Buffer; headers: Record<string, string> }) {
    const signingSecret = this.config.get<string>('CLERK_WEBHOOK_SECRET')

    if (!signingSecret) {
      throw new BadRequestException('Webhook signing secret not configured')
    }

    if (!req.rawBody) {
      throw new BadRequestException('Missing raw body')
    }

    // Build a standard Web API Request for verifyWebhook
    const request = new Request('https://placeholder.local/webhooks/clerk', {
      method: 'POST',
      headers: req.headers as HeadersInit,
      body: req.rawBody.buffer.slice(
        req.rawBody.byteOffset,
        req.rawBody.byteOffset + req.rawBody.byteLength,
      ) as ArrayBuffer,
    })

    let event: Awaited<ReturnType<typeof verifyWebhook>>

    try {
      event = await verifyWebhook(request, { signingSecret })
    } catch {
      this.logger.warn('Invalid webhook signature')
      throw new BadRequestException('Invalid webhook signature')
    }

    this.logger.log(`Received Clerk event: ${event.type}`)

    switch (event.type) {
      case 'user.created':
      case 'user.updated': {
        const data = event.data as {
          id: string
          email_addresses: { id: string; email_address: string }[]
          primary_email_address_id: string
          first_name: string | null
          last_name: string | null
          image_url: string | null
        }
        const primaryEmail = data.email_addresses.find(
          (e) => e.id === data.primary_email_address_id,
        )
        if (!primaryEmail) {
          this.logger.warn(`No primary email for user ${data.id}`)
          break
        }
        await this.usersService.upsert({
          clerkId: data.id,
          email: primaryEmail.email_address,
          firstName: data.first_name,
          lastName: data.last_name,
          avatarUrl: data.image_url,
        })
        break
      }

      case 'user.deleted': {
        const data = event.data as { id: string }
        await this.usersService.softDelete(data.id)
        break
      }

      default:
        this.logger.log(`Unhandled event type: ${event.type}`)
    }

    return { received: true }
  }
}
