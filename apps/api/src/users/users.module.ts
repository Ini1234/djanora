import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { UsersService } from './users.service'
import { UsersController } from './users.controller'
import { EventAccessModule } from '../events/event-access.module'

@Module({
  imports: [ConfigModule, EventAccessModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
