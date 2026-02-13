-- 修改 Activity 的 discountMin/Max 为非空并设默认值
ALTER TABLE `Activity` MODIFY COLUMN `discountMin` INT NOT NULL DEFAULT 70;
ALTER TABLE `Activity` MODIFY COLUMN `discountMax` INT NOT NULL DEFAULT 95;

-- 创建 ActivityJoin 表（包含 leftAt 字段）
CREATE TABLE `ActivityJoin` (
    `id` VARCHAR(191) NOT NULL,
    `activityId` VARCHAR(191) NOT NULL,
    `workId` VARCHAR(191) NOT NULL,
    `discount` INT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `leftAt` DATETIME(3) NULL,

    UNIQUE INDEX `ActivityJoin_activityId_workId_key`(`activityId`, `workId`),
    INDEX `ActivityJoin_workId_idx`(`workId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 添加外键
ALTER TABLE `ActivityJoin` ADD CONSTRAINT `ActivityJoin_activityId_fkey` FOREIGN KEY (`activityId`) REFERENCES `Activity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
