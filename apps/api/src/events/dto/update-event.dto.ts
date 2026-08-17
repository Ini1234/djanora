import { IsString, IsOptional, IsDateString, IsInt, Min, Max, MinLength } from 'class-validator'

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string

  @IsOptional()
  @IsDateString()
  estimatedDate?: string | null

  @IsOptional()
  @IsString()
  location?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5000)
  guestCount?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  totalBudget?: number
}
