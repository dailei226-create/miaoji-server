import { IsString, IsNumber } from 'class-validator';

export class CreatePrepayDto {
  @IsString()
  orderId!: string;

  @IsString()
  code!: string;

  @IsNumber()
  amount!: number;

  @IsString()
  description!: string;
}
