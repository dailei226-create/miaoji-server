import { IsArray, IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, Max } from 'class-validator';

export class UpsertWorkDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  desc?: string;

  @IsInt()
  @Min(1)
  @Max(99999999)
  price!: number;

  @IsInt()
  @Min(1)
  @Max(999)
  stock!: number;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  subCategoryId?: string;

  @IsBoolean()
  support7days!: boolean;

  @IsArray()
  images!: string[];
}

export class ReviewDecisionDto {
  @IsString()
  workId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateWorkWeightDto {
  @IsInt()
  weight!: number;
}

export class UpdateWorkDiscountDto {
  @IsOptional()
  @IsInt()
  discountPrice?: number | null;

  @IsOptional()
  @IsString()
  discountStartAt?: string | null;

  @IsOptional()
  @IsString()
  discountEndAt?: string | null;
}

/** 创作者自助设置活动折扣（折扣百分比，如 85 表示 8.5 折） */
export class SetCreatorDiscountDto {
  @IsInt()
  @Min(1)
  @Max(100)
  discountPercent!: number;
}

/** 创作者降价（价格单位与 Work.price 一致，如分） */
export class SetCreatorPriceDto {
  @IsInt()
  @Min(1)
  @Max(99999999)
  price!: number;
}

/** 运营下架 DTO */
export class OfflineWorkDto {
  @IsString()
  @MaxLength(500)
  reason!: string;
}
