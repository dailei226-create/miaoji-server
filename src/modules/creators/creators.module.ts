import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminCreatorsController } from './creators.admin.controller';
import { CreatorsController } from './creators.controller';
import { CreatorsService } from './creators.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminCreatorsController, CreatorsController],
  providers: [CreatorsService],
  exports: [CreatorsService],
})
export class CreatorsModule {}
