import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'
import { CONTACT_REASONS, type ContactReason } from './contact.mail'

export class SubmitContactDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string

  @IsEmail()
  email: string

  @IsIn(CONTACT_REASONS)
  reason: ContactReason

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(4000)
  message: string

  /** Honeypot. Must stay empty. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  company?: string
}
