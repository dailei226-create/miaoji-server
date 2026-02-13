import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertAddressDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MaxLength(64)
  name!: string;

  @IsString()
  @MaxLength(32)
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  province?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  district?: string;

  @IsString()
  @MaxLength(255)
  detail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  postalCode?: string;

  @IsOptional()
  @IsIn(['家','公司','学校'])
  tag?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
