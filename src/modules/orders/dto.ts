import { IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  workId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  qty?: number;

  @IsString()
  addressId!: string;

  /** 收货地址快照（name/phone/province/city/district/detail），写入订单便于发货 */
  @IsOptional()
  @IsObject()
  addressSnapshot?: Record<string, unknown>;
}

export class MockPayDto {
  @IsString()
  orderId!: string;
}
