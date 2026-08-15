import { IsString, MinLength } from 'class-validator'

export class BookQuoteDto {
  @IsString()
  @MinLength(1)
  messageId: string
}
