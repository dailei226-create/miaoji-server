-- CreateTable
CREATE TABLE `Activity` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `imageUrl` VARCHAR(512) NOT NULL,
    `linkUrl` VARCHAR(512) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `weight` INTEGER NOT NULL DEFAULT 0,
    `startAt` DATETIME(3) NULL,
    `endAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
