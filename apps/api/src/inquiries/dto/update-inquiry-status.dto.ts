import { IsIn } from 'class-validator'

export class UpdateInquiryStatusDto {
  @IsIn(['ACCEPTED', 'DECLINED'])
  status: 'ACCEPTED' | 'DECLINED'
}
