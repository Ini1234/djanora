import { IsString, IsEnum, IsIn, IsOptional, MinLength, IsISO8601, IsArray } from 'class-validator'
import { Tribe } from '@prisma/client'

export class CompleteOnboardingDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string

  @IsOptional()
  @IsString()
  lastName?: string

  @IsIn(['USER', 'VENDOR'])
  role: 'USER' | 'VENDOR'

  @IsOptional()
  @IsArray()
  @IsEnum(Tribe, { each: true })
  tribes?: Tribe[]

  @IsOptional()
  @IsString()
  city?: string

  @IsOptional()
  @IsString()
  countryOfOrigin?: string

  @IsOptional()
  @IsISO8601({ strict: true })
  dateOfBirth?: string // ISO 8601 date string e.g. "1995-06-15"
}
