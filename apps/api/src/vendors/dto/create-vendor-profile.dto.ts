import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  MinLength,
  MaxLength,
  IsArray,
  IsUrl,
} from 'class-validator'

export class CreateVendorProfileDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  businessName: string

  @IsString()
  category: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[]

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tribesServed?: string[]

  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedPriceFrom?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedPriceTo?: number

  @IsOptional()
  @IsString()
  city?: string

  @IsOptional()
  @IsUrl()
  websiteUrl?: string

  @IsOptional()
  @IsUrl()
  instagramUrl?: string

  @IsOptional()
  @IsUrl()
  facebookUrl?: string
}
