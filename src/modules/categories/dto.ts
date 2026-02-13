import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MaxLength(191)
  name!: string;

  @IsOptional()
  @IsInt()
  weight?: number;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  parentId?: string | null;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(191)
  name?: string;

  @IsOptional()
  @IsInt()
  weight?: number;
}

export class AdjustWeightDto {
  @IsInt()
  delta!: number;
}
