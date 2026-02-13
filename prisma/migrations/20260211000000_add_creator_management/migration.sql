-- 创作者/卖家管理系统

-- 创建 CreatorProfile 表（如果不存在）
CREATE TABLE IF NOT EXISTS `CreatorProfile` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `status` ENUM('pending', 'approved', 'rejected', 'frozen', 'banned') NOT NULL DEFAULT 'pending',
    `phone` VARCHAR(191) NULL,
    `realName` VARCHAR(191) NULL,
    `idCard` VARCHAR(191) NULL,
    `reason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CreatorProfile_userId_key`(`userId`),
    INDEX `CreatorProfile_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建 CreatorOpLog 表
CREATE TABLE IF NOT EXISTS `CreatorOpLog` (
    `id` VARCHAR(191) NOT NULL,
    `creatorProfileId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `fromStatus` VARCHAR(191) NULL,
    `toStatus` VARCHAR(191) NULL,
    `reason` TEXT NULL,
    `adminId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CreatorOpLog_creatorProfileId_createdAt_idx`(`creatorProfileId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 添加外键约束（忽略如果已存在）
-- ALTER TABLE `CreatorOpLog` ADD CONSTRAINT `CreatorOpLog_creatorProfileId_fkey` FOREIGN KEY (`creatorProfileId`) REFERENCES `CreatorProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
