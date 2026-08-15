import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator'

export class UpdatePortfolioItemDto {
  @IsOptional()
  @IsBoolean()
  isCover?: boolean

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string
}
