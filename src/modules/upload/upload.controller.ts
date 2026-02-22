import { Controller, Post, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { JwtAuthGuard } from '../auth/jwt.guard';

// 允许的 MIME 类型
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

// 获取年月目录 (YYYY/MM)
function getYearMonthDir(): string {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  return `${year}/${month}`;
}

// 确保目录存在
function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export const multerOptions = {
  storage: diskStorage({
    destination: (_req: unknown, _file: unknown, cb: (e: Error | null, p: string) => void) => {
      const subDir = getYearMonthDir();
      const fullDir = join('uploads', subDir);
      ensureDir(fullDir);
      cb(null, fullDir);
    },
    filename: (_req: unknown, file: { originalname?: string }, cb: (e: Error | null, p: string) => void) => {
      const ext = extname(file.originalname || '') || '.jpg';
      const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
      cb(null, name);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req: unknown, file: { mimetype?: string }, cb: (e: Error | null, accept: boolean) => void) => {
    const mime = file.mimetype || '';
    if (ALLOWED_MIMES.includes(mime)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${mime}，仅允许 jpeg/png/webp`), false);
    }
  },
};

/**
 * 图片上传接口
 * POST /upload - 登录用户可用
 * 返回 { url, size, mime }
 */
@Controller()
export class UploadController {
  @UseGuards(JwtAuthGuard)
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', multerOptions))
  upload(@UploadedFile() file: { filename?: string; path?: string; size?: number; mimetype?: string }) {
    if (!file) {
      throw new BadRequestException('请选择要上传的图片');
    }
    
    // 构建相对路径
    const subDir = getYearMonthDir();
    const relativePath = `/uploads/${subDir}/${file.filename}`;
    
    return {
      url: relativePath,
      size: file.size || 0,
      mime: file.mimetype || 'image/jpeg',
    };
  }
}
