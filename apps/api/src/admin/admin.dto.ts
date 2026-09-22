import { IsIn, IsString, MaxLength, MinLength } from 'class-validator'
import { UserRole } from '@prisma/client'

export class ReviewReasonDto {
  @IsString()
  @MinLength(4)
  @MaxLength(500)
  reason!: string
}

export class SetUserRoleDto {
  @IsIn(['USER', 'VENDOR', 'ADMIN'])
  role!: UserRole
}
