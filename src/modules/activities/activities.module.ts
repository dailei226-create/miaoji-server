import { Module } from '@nestjs/common';
import { ActivitiesController, CreatorActivityController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { AdminActivitiesController } from './activities.admin.controller';

@Module({
  controllers: [ActivitiesController, AdminActivitiesController, CreatorActivityController],
  providers: [ActivitiesService],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
