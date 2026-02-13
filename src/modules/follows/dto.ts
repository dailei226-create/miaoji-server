import { IsString } from 'class-validator';

export class CreateFollowDto {
  @IsString()
  creatorId!: string;
}
