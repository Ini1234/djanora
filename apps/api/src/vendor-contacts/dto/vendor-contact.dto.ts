import {
  IsString, IsOptional, IsEmail, IsUrl,
  MinLength, MaxLength, IsEnum,
} from 'class-validator'
import { VendorCategory } from '@prisma/client'

export class CreateVendorContactDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string

  @IsOptional()
  @IsEnum(VendorCategory)
  category?: VendorCategory

  @IsOptional()
  @IsEmail()
  email?: string

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string

  @IsOptional()
  @IsUrl()
  website?: string

  @IsOptional()
  @IsString()
  notes?: string
}

export class UpdateVendorContactDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string

  @IsOptional()
  @IsEnum(VendorCategory)
  category?: VendorCategory

  @IsOptional()
  @IsEmail()
  email?: string

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string

  @IsOptional()
  @IsUrl()
  website?: string

  @IsOptional()
  @IsString()
  notes?: string
}
