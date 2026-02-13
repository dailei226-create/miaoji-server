import { Module } from '@nestjs/common';
import { PayController } from './pay.controller';
import { PayService } from './pay.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PayController],
  providers: [PayService],
})
export class PayModule {}

// MVP一期-订单闭环：支付回调内更新订单状态需要 Prisma 支持
