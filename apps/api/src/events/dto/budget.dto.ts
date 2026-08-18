import { Type } from 'class-transformer'
import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  IsEnum,
  IsArray,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator'
import { VendorCategory } from '@prisma/client'

export class CreateBudgetItemDto {
  @IsEnum(VendorCategory)
  category: VendorCategory

  @IsOptional()
  @IsString()
  label?: string

  @IsOptional()
  @IsString()
  vendorName?: string

  /** ID of a registered VendorProfile (platform vendor) */
  @IsOptional()
  @IsString()
  vendorProfileId?: string

  /** ID of a UserVendorContact (personal contact book) */
  @IsOptional()
  @IsString()
  userVendorContactId?: string

  @IsOptional()
  @IsString()
  notes?: string

  @Type(() => Number)
  @IsInt()
  @Min(0)
  allocatedAmount: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  spentAmount?: number
}

export class UpdateBudgetItemDto {
  @IsOptional()
  @IsString()
  label?: string

  @IsOptional()
  @IsString()
  vendorName?: string

  @IsOptional()
  @IsString()
  vendorProfileId?: string

  @IsOptional()
  @IsString()
  userVendorContactId?: string

  @IsOptional()
  @IsString()
  notes?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  allocatedAmount?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  spentAmount?: number
}

export class ImportBudgetDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CreateBudgetItemDto)
  items: CreateBudgetItemDto[]
}
