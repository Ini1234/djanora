import { Type } from 'class-transformer'
import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator'

export class CreateAssistantThreadDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  eventId?: string
}

export class AssistantPageContextDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  pathname?: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string

  @IsOptional()
  @IsString()
  @MaxLength(40)
  eventId?: string

  @IsOptional()
  @IsString()
  @MaxLength(40)
  tab?: string
}

export class PostAssistantMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content!: string

  @IsOptional()
  @ValidateNested()
  @Type(() => AssistantPageContextDto)
  pageContext?: AssistantPageContextDto
}

export class ConfirmAssistantJobDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  tool!: string

  @IsObject()
  args!: Record<string, unknown>

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  confirmToken!: string
}

export class PatchAssistantThreadDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  eventId?: string | null
}
