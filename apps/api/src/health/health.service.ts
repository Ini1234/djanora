import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class HealthService {
  constructor(private prisma: PrismaService) {}

  live() {
    return { status: 'ok' as const }
  }

  async ready() {
    try {
      await this.prisma.ping()
      return { status: 'ok' as const, database: 'up' as const }
    } catch {
      throw new ServiceUnavailableException({ status: 'unavailable', database: 'down' })
    }
  }
}
