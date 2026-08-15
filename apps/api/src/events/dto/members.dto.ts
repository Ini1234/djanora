import { Type } from 'class-transformer'
import {
  IsEmail,
  IsEnum,
  IsArray,
  ArrayMinSize,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'
import { EventMemberRole, EventSurface } from '@prisma/client'

export class ChildGrantDto {
  @IsString()
  eventId: string

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(EventSurface, { each: true })
  surfaces: EventSurface[]
}

export class InviteMemberDto {
  @IsEmail()
  email: string

  @IsEnum(EventMemberRole)
  role: EventMemberRole

  @IsArray()
  @IsEnum(EventSurface, { each: true })
  surfaces: EventSurface[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChildGrantDto)
  childGrants?: ChildGrantDto[]
}

export class UpdateMemberDto {
  @IsOptional()
  @IsEnum(EventMemberRole)
  role?: EventMemberRole

  @IsOptional()
  @IsArray()
  @IsEnum(EventSurface, { each: true })
  surfaces?: EventSurface[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChildGrantDto)
  childGrants?: ChildGrantDto[]
}
