import {
  IsString,
  IsEnum,
  IsArray,
  ArrayMinSize,
  IsInt,
  IsOptional,
  IsBoolean,
  IsDateString,
  Min,
  Max,
  MinLength,
} from 'class-validator'
import { Tribe, WeddingTheme, EventType } from '@prisma/client'

export class CreateEventDto {
  @IsString()
  @MinLength(2)
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

  @IsInt()
  @Min(0)
  totalBudget: number

  @IsOptional()
  @IsBoolean()
  includeDefaultBudget?: boolean

  @IsOptional()
  @IsBoolean()
  includeDefaultChecklist?: boolean

  @IsOptional()
  @IsDateString()
  estimatedDate?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5000)
  guestCount?: number

  @IsOptional()
  @IsString()
  location?: string
}
