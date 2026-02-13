import { Controller, Post, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, basename } from 'path';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

const UPLOAD_DIR = 'uploads';

export const multerOptions = {
  storage: diskStorage({
    destination: (_req: unknown, _file: unknown, cb: (e: Error | null, p: string) => void) => {
      cb(null, UPLOAD_DIR);
    },
    filename: (_req: unknown, file: { originalname?: string }, cb: (e: Error | null, p: string) => void) => {
      const ext = extname(file.originalname || '') || '.jpg';
      const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
      cb(null, name);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
};

/** 后台图片上传：返回相对路径 /uploads/xxx，保存活动 Banner 时请拼上 API 根地址作为完整 URL */
@Controller()
export class UploadController {
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', multerOptions))
  upload(@UploadedFile() file: { filename?: string; path?: string }) {
    if (!file) return { url: '' };
    const name = file.filename || (file.path ? basename(file.path) : '');
    if (!name) return { url: '' };
    return { url: `/uploads/${name}` };
  }
}
