// Force Node process timezone to UTC for consistent Date behavior.
// Must be set before any modules rely on Date formatting/parsing.
process.env.TZ = 'UTC';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as bodyParser from 'body-parser';
import { join } from 'path';
import * as fs from 'fs';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Enable DTO validation/transform globally (safe, does not touch payment logic).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const uploadsDir = join(process.cwd(), 'uploads');
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (_) {}
  app.useStaticAssets(uploadsDir, { prefix: '/uploads' });

  // 必须：保留 rawBody（微信支付回调用于验签）
  app.use(
    bodyParser.json({
      limit: '2mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf?.toString('utf8') || '';
      },
    }),
  );
  app.use(
    bodyParser.urlencoded({
      extended: true,
      verify: (req: any, _res, buf) => {
        req.rawBody = buf?.toString('utf8') || '';
      },
    }),
  );

  app.enableCors({
    origin: true,
    credentials: true,
  });

  const port = Number(process.env.PORT || 3100);
  await app.listen(port, '0.0.0.0');
  console.log(`MiaoJi server listening on :${port}`);
}
bootstrap();
