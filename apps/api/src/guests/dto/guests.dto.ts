import {
  IsString,
  IsOptional,
  IsEmail,
  IsBoolean,
  IsEnum,
  IsArray,
  IsNotEmpty,
  MinLength,
} from 'class-validator'

export class CreateGuestDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  firstName: string

  @IsOptional()
  @IsString()
  lastName?: string

  @IsOptional()
  @IsEmail()
  email?: string

  @IsOptional()
  @IsString()
  phone?: string

  @IsOptional()
  @IsString()
  note?: string

  @IsOptional()
  @IsBoolean()
  plusOneAllowed?: boolean

  @IsOptional()
  @IsString()
  tableNumber?: string
}

export class UpdateGuestDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string

  @IsOptional()
  @IsString()
  lastName?: string

  @IsOptional()
  @IsEmail()
  email?: string

  @IsOptional()
  @IsString()
  phone?: string

  @IsOptional()
  @IsString()
  note?: string

  @IsOptional()
  @IsBoolean()
  plusOneAllowed?: boolean

  @IsOptional()
  @IsString()
  tableNumber?: string
}

export class SendInviteDto {
  @IsEnum(['email', 'sms', 'both'])
  via: 'email' | 'sms' | 'both'

  @IsOptional()
  @IsString()
  customNote?: string
}

export class BulkSendInviteDto {
  @IsArray()
  @IsString({ each: true })
  guestIds: string[]

  @IsEnum(['email', 'sms', 'both'])
  via: 'email' | 'sms' | 'both'

  @IsOptional()
  @IsString()
  customNote?: string
}

export class SubmitRsvpDto {
  @IsEnum(['ATTENDING', 'DECLINED', 'MAYBE'])
  status: 'ATTENDING' | 'DECLINED' | 'MAYBE'

  @IsOptional()
  @IsString()
  plusOneName?: string

  @IsOptional()
  @IsString()
  dietaryNote?: string

  @IsOptional()
  @IsString()
  guestMessage?: string
}
