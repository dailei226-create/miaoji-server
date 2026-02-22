"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
process.env.TZ = 'UTC';
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const bodyParser = require("body-parser");
const path_1 = require("path");
const fs = require("fs");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
    }));
    const uploadsDir = (0, path_1.join)(process.cwd(), 'uploads');
    try {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }
    catch (_) { }
    app.useStaticAssets(uploadsDir, { prefix: '/uploads' });
    app.use(bodyParser.json({
        limit: '2mb',
        verify: (req, _res, buf) => {
            req.rawBody = buf?.toString('utf8') || '';
        },
    }));
    app.use(bodyParser.urlencoded({
        extended: true,
        verify: (req, _res, buf) => {
            req.rawBody = buf?.toString('utf8') || '';
        },
    }));
    app.enableCors({
        origin: true,
        credentials: true,
    });
    const port = Number(process.env.PORT || 3100);
    await app.listen(port, '0.0.0.0');
    console.log(`MiaoJi server listening on :${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map