-- 创作者申请资料字段

ALTER TABLE `CreatorProfile` ADD COLUMN `applyData` JSON NULL;
ALTER TABLE `CreatorProfile` ADD COLUMN `appliedAt` DATETIME(3) NULL;
