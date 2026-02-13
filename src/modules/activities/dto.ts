// FREEZE(activity): DTO structure locked. Only BUGFIX/STYLE allowed.
// DO NOT change field names or validation rules. Any modification must include [BUGFIX] in commit.

import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, IsNotEmpty } from 'class-validator';

export class CreateActivityDto {
  @IsString()
  @MaxLength(191)
  title!: string;

  @IsString()
  @MaxLength(512)
  imageUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  linkUrl?: string;

  @IsOptional()
  @IsString()
  @IsIn(['webview', 'mini', 'none'])
  linkType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  appId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  path?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  weight?: number;

  @IsOptional()
  @IsString()
  startAt?: string;

  @IsOptional()
  @IsString()
  endAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  discountMin?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  discountMax?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  durationDays?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];
}

export class UpdateActivityDto {
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
  @MaxLength(512)
  linkUrl?: string;

  @IsOptional()
  @IsString()
  @IsIn(['webview', 'mini', 'none'])
  linkType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  appId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  path?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  weight?: number;

  @IsOptional()
  @IsString()
  startAt?: string;

  @IsOptional()
  @IsString()
  endAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  discountMin?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  discountMax?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  durationDays?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];
}

export class JoinActivityDto {
  @IsString()
  @IsNotEmpty()
  workId!: string;

  @IsInt()
  @Min(1)
  @Max(100)
  discount!: number;
}

export class LeaveActivityDto {
  @IsString()
  @IsNotEmpty()
  workId!: string;
}
