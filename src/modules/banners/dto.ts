import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUrl, MaxLength, ValidateIf } from 'class-validator';

// 与 schema.prisma 中的 BannerPosition 对应
export const BANNER_POSITIONS = ['HOME', 'ACTIVITY', 'MARKET'] as const;
export type BannerPosition = (typeof BANNER_POSITIONS)[number];

// 与 schema.prisma 中的 BannerTargetType 对应
// Keep backward compatible values, while adding the long-term correct ones.
export const BANNER_TARGET_TYPES = [
  // new
  'NONE',
  'H5',
  'CREATOR',
  'WORK',
  'CATEGORY',
  // legacy
  'CATEGORY_L1',
  'CATEGORY_L2',
  'AUTHOR',
  'WORK_DETAIL',
  'TOPIC_NEW',
] as const;
export type BannerTargetType = (typeof BANNER_TARGET_TYPES)[number];

export class CreateBannerDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsString()
  @MaxLength(512)
  imageUrl!: string;

  @IsIn(BANNER_POSITIONS)
  position!: BannerPosition;

  @IsIn(BANNER_TARGET_TYPES)
  targetType!: BannerTargetType;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  targetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  // allow http/https; allow empty string to clear value on update
  @ValidateIf((o) => o.linkUrl !== undefined && o.linkUrl !== null && String(o.linkUrl).trim() !== '')
  @IsUrl({ require_protocol: true })
  linkUrl?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateBannerDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  imageUrl?: string;

  @IsOptional()
  @IsIn(BANNER_POSITIONS)
  position?: BannerPosition;

  @IsOptional()
  @IsIn(BANNER_TARGET_TYPES)
  targetType?: BannerTargetType;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  targetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  @ValidateIf((o) => o.linkUrl !== undefined && o.linkUrl !== null && String(o.linkUrl).trim() !== '')
  @IsUrl({ require_protocol: true })
  linkUrl?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
