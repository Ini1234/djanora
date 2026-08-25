import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'
import { Type } from 'class-transformer'

export class PostInquiryMessageDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message?: string

  @IsOptional()
  @IsIn(['TEXT', 'QUOTE', 'LINK', 'INSPIRATION'])
  kind?: 'TEXT' | 'QUOTE' | 'LINK' | 'INSPIRATION'

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount?: number

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string

  @IsOptional()
  @IsString()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  url?: string

  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string

  @IsOptional()
  @IsIn(['calendar', 'booking'])
  linkKind?: 'calendar' | 'booking'

  @IsOptional()
  @IsString()
  inspirationItemId?: string
}
