import { IsArray, IsEnum, IsNumber, IsOptional, IsString, IsUrl, MaxLength, MinLength, ValidateIf } from 'class-validator'
import { InspirationCategory, InspirationVisibility } from '@prisma/client'

export class CreateVendorPostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string

  @IsEnum(InspirationCategory)
  category!: InspirationCategory

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string

  @IsOptional()
  @IsNumber()
  priceRangeFrom?: number

  @IsOptional()
  @IsNumber()
  priceRangeTo?: number

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string

  @IsOptional()
  @IsString()
  @MaxLength(240)
  costNote?: string

  @IsOptional()
  @IsEnum(InspirationVisibility)
  visibility?: InspirationVisibility
}

export class UpdateVendorPostDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string

  @IsOptional()
  @IsEnum(InspirationCategory)
  category?: InspirationCategory

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string

  @IsOptional()
  @IsNumber()
  priceRangeFrom?: number | null

  @IsOptional()
  @IsNumber()
  priceRangeTo?: number | null

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string

  @IsOptional()
  @IsString()
  @MaxLength(240)
  costNote?: string | null

  @IsOptional()
  @IsEnum(InspirationVisibility)
  visibility?: InspirationVisibility
}

export class AddExternalMediaDto {
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  url!: string
}

export class UpdateVendorMeDto {
  @IsOptional()
  @ValidateIf((_, v) => typeof v === 'string' && v.trim().length > 0)
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  externalPortfolioUrl?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(80)
  externalPortfolioLabel?: string | null
}
