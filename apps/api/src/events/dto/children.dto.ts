import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator'
import { EventType, Tribe, WeddingTheme } from '@prisma/client'

export class CreateChildEventDto {
  @IsString()
  @MinLength(1)
  title: string

  @IsEnum(EventType)
  eventType: EventType

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(Tribe, { each: true })
  tribes: Tribe[]

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(WeddingTheme, { each: true })
  themes: WeddingTheme[]

  @IsString()
  @MinLength(1)
  location: string

  @IsOptional()
  @IsDateString()
  estimatedDate?: string | null

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5000)
  guestCount?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  allocatedBudget?: number
}

export class AttachChildEventDto {
  @IsString()
  eventId: string
}

export class ReorderChildrenDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  eventIds: string[]
}
