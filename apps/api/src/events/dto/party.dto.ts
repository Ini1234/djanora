import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator'
import { EventPartySide, EventPartyStatus } from '@prisma/client'

export class CreatePartyMemberDto {
  @IsString()
  @MinLength(1)
  name: string

  @IsOptional()
  @IsString()
  role?: string

  @IsOptional()
  @IsEnum(EventPartySide)
  side?: EventPartySide

  @IsOptional()
  @IsString()
  group?: string | null

  @IsOptional()
  @IsString()
  bio?: string | null

  @IsOptional()
  @IsBoolean()
  showOnSite?: boolean

  @IsOptional()
  @IsEnum(EventPartyStatus)
  status?: EventPartyStatus

  @IsOptional()
  @IsString()
  pairedWithId?: string | null
}

export class UpdatePartyMemberDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string

  @IsOptional()
  @IsString()
  role?: string

  @IsOptional()
  @IsEnum(EventPartySide)
  side?: EventPartySide

  @IsOptional()
  @IsString()
  group?: string | null

  @IsOptional()
  @IsString()
  bio?: string | null

  @IsOptional()
  @IsBoolean()
  showOnSite?: boolean

  @IsOptional()
  @IsEnum(EventPartyStatus)
  status?: EventPartyStatus

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number

  @IsOptional()
  @IsString()
  pairedWithId?: string | null
}

export class PairPartyMemberDto {
  @IsString()
  partnerId: string
}
