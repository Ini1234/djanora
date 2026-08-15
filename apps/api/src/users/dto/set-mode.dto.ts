import { IsIn } from 'class-validator'

export class SetModeDto {
  @IsIn(['user', 'vendor'])
  mode!: 'user' | 'vendor'
}
