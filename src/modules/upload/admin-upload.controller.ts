import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;
const PUBLIC_BASE = 'https://moji.yanxiangtaoci.cn';

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function rand8() {
  return Math.random().toString(36).slice(2, 10);
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/upload')
export class AdminUploadController {
  @Post('banner')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = join(process.cwd(), 'uploads', 'banners');
          ensureDir(dir);
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname || '') || '.jpg';
          const name = `${Date.now()}_${rand8()}${ext}`;
          cb(null, name);
        },
      }),
      limits: { fileSize: MAX_SIZE },
      fileFilter: (_req, file, cb) => {
        const mime = file.mimetype || '';
        if (ALLOWED_MIMES.includes(mime)) cb(null, true);
        else cb(new Error(`不支持的文件类型: ${mime}，仅允许 jpeg/png/webp`), false);
      },
    }),
  )
  uploadBanner(@UploadedFile() file?: { filename?: string; mimetype?: string; size?: number }) {
    if (!file || !file.filename) throw new BadRequestException('请选择要上传的图片');
    const base = PUBLIC_BASE.replace(/\/$/, '');
    return {
      url: `${base}/uploads/banners/${file.filename}`,
    };
  }
}

