import { IsString, IsNotEmpty, IsOptional, MinLength, MaxLength, IsDateString } from 'class-validator'

export class CreateInquiryDto {
  @IsOptional()
  @IsString()
  eventId?: string

  @IsString()
  @IsNotEmpty()
  vendorProfileId: string

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  message: string

  @IsOptional()
  @IsDateString()
  eventDate?: string

  @IsOptional()
  @IsString()
  inspirationItemId?: string
}
