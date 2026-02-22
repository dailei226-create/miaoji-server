import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { AdminUploadController } from './admin-upload.controller';

@Module({
  controllers: [UploadController, AdminUploadController],
})
export class UploadModule {}
