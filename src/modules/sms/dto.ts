import { IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const PHONE_REG = /^1\d{10}$/;

export class SmsSendDto {
  @IsString()
  @Matches(PHONE_REG, { message: '手机号格式错误' })
  phone!: string;

  @IsIn(['bank_bind'])
  scene!: 'bank_bind';
}

export class SmsVerifyDto {
  @IsString()
  @Matches(PHONE_REG, { message: '手机号格式错误' })
  phone!: string;

  @IsIn(['bank_bind'])
  scene!: 'bank_bind';

  @IsString()
  @MinLength(4)
  @MaxLength(8)
  code!: string;
}
