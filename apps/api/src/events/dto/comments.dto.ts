import {
  IsEnum,
  IsString,
  IsOptional,
  IsArray,
  MinLength,
  MaxLength,
} from 'class-validator'
import { EventCommentSubject } from '@prisma/client'

export class CreateCommentDto {
  @IsEnum(EventCommentSubject)
  subjectType: EventCommentSubject

  @IsString()
  subjectId: string

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body: string

  @IsOptional()
  @IsString()
  parentId?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentionUserIds?: string[]
}

export class UpdateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body: string
}
