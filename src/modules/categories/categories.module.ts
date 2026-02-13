import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminCategoriesController } from './categories.admin.controller';
import { CategoriesService } from './categories.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminCategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
