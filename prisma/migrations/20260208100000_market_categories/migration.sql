-- CreateTable: 集市类目（一级 parentId 为空，二级 parentId 为一级 id）
CREATE TABLE `Category` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `weight` INTEGER NOT NULL DEFAULT 0,
    `parentId` VARCHAR(191) NULL,
    `dynamicWeight` INTEGER NULL,
    `behaviorScore` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `Category_parentId_idx` ON `Category`(`parentId`);

ALTER TABLE `Category` ADD CONSTRAINT `Category_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Category`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: 活动可参加类目 = 集市类目 id 数组
ALTER TABLE `Activity` ADD COLUMN `categoryIds` JSON NULL;
