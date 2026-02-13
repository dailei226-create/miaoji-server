-- 添加 received 和 paid_mock 状态，以及 receivedAt 字段

-- 修改枚举，添加新状态
ALTER TABLE `Order` MODIFY COLUMN `status` ENUM('created', 'paid', 'paid_mock', 'shipped', 'received', 'completed', 'canceled', 'refund_requested', 'refund_approved', 'refund_rejected', 'refunded') NOT NULL DEFAULT 'created';

-- 添加 receivedAt 字段（如果不存在）
-- ALTER TABLE `Order` ADD COLUMN `receivedAt` DATETIME(3) NULL;
