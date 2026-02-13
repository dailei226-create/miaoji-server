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
