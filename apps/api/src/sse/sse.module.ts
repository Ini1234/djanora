import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { SseService } from './sse.service'
import { SseController } from './sse.controller'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [SseController],
  providers: [SseService],
  exports: [SseService],
})
export class SseModule {}
