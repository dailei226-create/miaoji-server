import { Controller, Get } from '@nestjs/common';
import { ConfigService } from './config.service';

/** GET /config 返回活动配置 + 集市类目树（均来自 DB）；前端/集市/活动统一消费集市类目 */
@Controller('config')
export class ConfigController {
  constructor(private config: ConfigService) {}

  @Get()
  async getConfig() {
    const [activity, marketCategories] = await Promise.all([
      this.config.getActivity(),
      this.config.getMarketCategoriesTree(),
    ]);
    return { activity, marketCategories };
  }
}
