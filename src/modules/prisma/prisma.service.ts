import { Injectable, OnModuleInit, INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
    // Force MySQL session timezone to UTC to avoid "wall clock" NOW() values.
    // Even if we migrate raw SQL to UTC_TIMESTAMP, this keeps behavior consistent.
    await this.$executeRawUnsafe(`SET time_zone = '+00:00'`);
  }

  async enableShutdownHooks(app: INestApplication) {
// this.$on('beforeExit', async () => {
//   await this.$disconnect()
// });
  }
}
