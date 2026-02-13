import { IsString, IsEnum, MinLength, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}

export class UpdateTicketStatusDto {
  @IsEnum(['OPEN', 'CLOSED'])
  status!: 'OPEN' | 'CLOSED';
}
