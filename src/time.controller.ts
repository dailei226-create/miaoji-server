import { Controller, Get, NotFoundException } from '@nestjs/common';
import { PrismaService } from './modules/prisma/prisma.service';

@Controller('time')
export class TimeController {
  constructor(private prisma: PrismaService) {}

  @Get('now')
  async now() {
    // Dev-only diagnostics endpoint.
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }

    const serverNow = new Date();
    const db: any[] = await this.prisma.$queryRawUnsafe(
      "SELECT UTC_TIMESTAMP(3) AS dbNowUtc, NOW(3) AS dbNowSession, @@session.time_zone AS sessionTz, @@global.time_zone AS globalTz",
    );

    return {
      serverNowISO: serverNow.toISOString(),
      nodeTZ: process.env.TZ || '',
      // Useful to confirm runtime timezone behavior (should be UTC after process.env.TZ).
      serverNowLocalString: serverNow.toString(),
      db: db && db[0] ? db[0] : null,
    };
  }
}

