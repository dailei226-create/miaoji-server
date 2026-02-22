import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class MockLoginDto {
  @IsString()
  @MaxLength(128)
  openId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  nickname?: string;

  @IsOptional()
  @IsIn(['buyer', 'creator', 'admin'])
  role?: 'buyer' | 'creator' | 'admin';
}

/**
 * 真实登录 DTO
 * 接收小程序 wx.login 返回的 code
 */
export class LoginDto {
  @IsString()
  @MaxLength(256)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  nickname?: string;
}
