import { IsString, IsEnum, IsOptional, IsArray, IsNumber, ArrayMinSize } from 'class-validator'
import { InspirationCategory } from '@prisma/client'

export class CreateInspirationDto {
  @IsString()
  title: string

  @IsString()
  description: string

  @IsOptional()
  @IsEnum(InspirationCategory)
  category?: InspirationCategory

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(InspirationCategory, { each: true })
  categories?: InspirationCategory[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]

  @IsOptional()
  @IsString()
  imageUrl?: string

  @IsOptional()
  @IsString()
  location?: string

  @IsOptional()
  @IsNumber()
  priceRangeFrom?: number

  @IsOptional()
  @IsNumber()
  priceRangeTo?: number

  @IsOptional()
  @IsString()
  currency?: string

  @IsOptional()
  @IsString()
  vendorProfileId?: string
}
