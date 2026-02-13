# 妙集项目封版清单

> 最后更新：2026-02-08
> 
> **重要**：封版文件只允许 BUGFIX（修复明确 bug）或 STYLE（样式微调）操作。
> 任何修改封版文件的提交必须在 commit message 中标注 `[BUGFIX]` 或 `[STYLE]`，否则不允许提交。

---

## 一、活动/折扣模块（FREEZE:activity）

### 封版原因
活动 = 折扣商品 的完整链路已跑通并稳定，包括：
- 活动创建/启用/多活动并存
- 作品参加/退出活动
- effectivePrice 计算
- 前端折扣展示

### 后端封版文件

| 文件路径 | 封版内容 |
|---------|---------|
| `prisma/schema.prisma` | ActivityJoin 模型结构 |
| `src/modules/activities/activities.service.ts` | 活动服务核心逻辑 |
| `src/modules/activities/activities.controller.ts` | 活动 API 接口 |
| `src/modules/activities/dto.ts` | 活动 DTO 字段定义 |
| `src/modules/works/works.service.ts` | effectivePrice / buildActivityJoinMap 逻辑 |

### 小程序封版文件

| 文件路径 | 封版内容 |
|---------|---------|
| `utils/pricing.js` | applyPromo 函数结构 |
| `components/work-card/work-card.js` | 价格/折扣展示逻辑 |
| `components/work-card/work-card.wxml` | 卡片结构 |
| `components/work-card/work-card.wxss` | 卡片样式 |
| `pages/activity-join/activity-join.js` | 参加活动页面逻辑 |
| `pages/activity-join/activity-join.wxml` | 参加活动页面结构 |
| `pages/activity-join/activity-join.wxss` | 参加活动页面样式 |
| `pages/activity/activity.js` | 活动首页逻辑 |
| `pages/activity-category/activity-category.js` | 活动分类页逻辑 |

### 允许操作
- `[BUGFIX]`：修复明确的显示错误、数据丢失、逻辑 bug
- `[STYLE]`：样式微调（颜色、间距、字号等，不影响结构）

### 禁止操作
- 修改 ActivityJoin 表结构
- 修改 effectivePrice 计算逻辑
- 修改 applyPromo 返回字段结构
- 从活动模块"借用"字段/逻辑给其他功能
- 重构、升级依赖

---

## 二、支付/订单/审核模块（隐式封版）

### 封版原因
涉及资金流转，任何改动必须 0 风险，不在日常迭代范围内。

### 涉及文件
- `prisma/schema.prisma`（Order / OrderItem 模型）
- `src/modules/orders/**`
- `src/modules/pay/**`
- 小程序支付相关页面

### 允许操作
- 仅限紧急 BUGFIX，需单独评审

### 禁止操作
- 任何日常迭代修改

---

## 三、提交规范

### Commit Message 格式
```
[BUGFIX] 修复活动页折扣角标不显示问题
[STYLE] 调整活动卡片间距
```

### 检查方式（可选）
提交前检查：如果 diff 涉及本文档列出的文件，但 commit message 不含 `[BUGFIX]` 或 `[STYLE]`，则提示阻止。

---

## 四、解封流程

如确需修改封版文件的核心逻辑：
1. 提出需求说明，解释为何必须修改
2. 评估影响范围
3. 在 commit message 中标注 `[UNFREEZE:activity]` 并说明原因
4. 修改后重新验收完整链路

---

*本文档由工程化封版任务自动生成，请勿随意删除。*
