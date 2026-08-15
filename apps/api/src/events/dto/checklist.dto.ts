import {
  IsString,
  IsBoolean,
  IsOptional,
  IsDateString,
  MinLength,
  IsArray,
  ValidateIf,
} from 'class-validator'

export class CreateChecklistItemDto {
  @IsString()
  @MinLength(2)
  title: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsDateString()
  dueDate?: string

  @IsOptional()
  @IsBoolean()
  notifyByEmail?: boolean

  @IsOptional()
  @IsBoolean()
  notifyBySms?: boolean

  @IsOptional()
  @IsBoolean()
  needsVendor?: boolean

  @IsOptional()
  @IsString()
  vendorCategory?: string

  @IsOptional()
  @IsString()
  vendorProfileId?: string

  @IsOptional()
  @IsString()
  userVendorContactId?: string
}

export class UpdateChecklistItemDto {
  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean

  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsDateString()
  dueDate?: string | null

  @IsOptional()
  @IsBoolean()
  notifyByEmail?: boolean

  @IsOptional()
  @IsBoolean()
  notifyBySms?: boolean

  @IsOptional()
  @IsBoolean()
  needsVendor?: boolean

  @IsOptional()
  @IsString()
  vendorCategory?: string | null

  @IsOptional()
  @IsString()
  vendorProfileId?: string | null

  @IsOptional()
  @IsString()
  userVendorContactId?: string | null

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  assigneeUserId?: string | null

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hiddenFromMemberIds?: string[]
}
