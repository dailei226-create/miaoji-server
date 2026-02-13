import { Module } from '@nestjs/common';
import { CreatorsModule } from '../creators/creators.module';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { AdminOrdersController } from './orders.admin.controller';

@Module({
  imports: [CreatorsModule],
  providers: [OrdersService],
  controllers: [OrdersController, AdminOrdersController],
})
export class OrdersModule {}
