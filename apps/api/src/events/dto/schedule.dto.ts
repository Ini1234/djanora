import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  MinLength,
  Matches,
  ValidateIf,
  IsArray,
} from 'class-validator'

const TIME = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

export class CreateScheduleItemDto {
  @IsString()
  @MinLength(2)
  title: string

  @IsOptional()
  @IsString()
  notes?: string

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @Matches(DATE, { message: 'Use a date, e.g. 2026-09-12' })
  date?: string | null

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @Matches(TIME, { message: 'Use 24-hour time, e.g. 14:30' })
  startTime?: string | null

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @Matches(TIME, { message: 'Use 24-hour time, e.g. 16:00' })
  endTime?: string | null

  @IsOptional()
  @IsString()
  location?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  budgetItemIds?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  checklistItemIds?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  inspirationItemIds?: string[]
}

export class UpdateScheduleItemDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string

  @IsOptional()
  @IsString()
  notes?: string | null

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @Matches(DATE, { message: 'Use a date, e.g. 2026-09-12' })
  date?: string | null

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @Matches(TIME, { message: 'Use 24-hour time, e.g. 14:30' })
  startTime?: string | null

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @Matches(TIME, { message: 'Use 24-hour time, e.g. 16:00' })
  endTime?: string | null

  @IsOptional()
  @IsString()
  location?: string | null

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  budgetItemIds?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  checklistItemIds?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  inspirationItemIds?: string[]

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number
}
