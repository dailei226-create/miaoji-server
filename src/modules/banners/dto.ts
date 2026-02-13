import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

// 与 schema.prisma 中的 BannerPosition 对应
export type BannerPosition = 'HOME' | 'ACTIVITY';

// 与 schema.prisma 中的 BannerTargetType 对应
export type BannerTargetType = 'CATEGORY_L1' | 'CATEGORY_L2' | 'AUTHOR' | 'WORK_DETAIL' | 'TOPIC_NEW';

export class CreateBannerDto {
  @IsOptional()
  @IsString()
  @MaxLength(191)
  title?: string;

  @IsString()
  @MaxLength(512)
  imageUrl!: string;

  @IsString()
  position!: BannerPosition;

  @IsString()
  targetType!: BannerTargetType;

  @IsOptional()
  @IsInt()
  targetId?: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateBannerDto {
  @IsOptional()
  @IsString()
  @MaxLength(191)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  position?: BannerPosition;

  @IsOptional()
  @IsString()
  targetType?: BannerTargetType;

  @IsOptional()
  @IsInt()
  targetId?: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
