import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator'

export class CreateUserChecklistDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string

  @IsDateString()
  dueDate: string

  @IsOptional()
  @IsString()
  eventId?: string | null
}

export class UpdateUserChecklistDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string

  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  dueDate?: string | null

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsString()
  eventId?: string | null
}
