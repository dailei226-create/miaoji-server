import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { WorksService } from './works.service';
import { WorksController } from './works.controller';
import { AdminWorksController } from './works.admin.controller';

@Module({
  imports: [ConfigModule],
  providers: [WorksService],
  controllers: [WorksController, AdminWorksController],
})
export class WorksModule {}
