import { Module } from '@nestjs/common';
import { CreatorAgreementController } from './creator-agreement.controller';
import { CreatorAgreementService } from './creator-agreement.service';

@Module({
  controllers: [CreatorAgreementController],
  providers: [CreatorAgreementService],
})
export class CreatorAgreementModule {}
