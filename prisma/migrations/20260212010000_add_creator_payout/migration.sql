-- 创作者收款账号/实名银行卡信息

CREATE TABLE IF NOT EXISTS `CreatorPayout` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `holderName` VARCHAR(191) NULL,
    `holderIdNumber` VARCHAR(191) NULL,
    `reservedPhone` VARCHAR(191) NULL,
    `cardNumber` VARCHAR(191) NULL,
    `bankName` VARCHAR(191) NULL,
    `branchName` VARCHAR(191) NULL,
    `realnameAuthed` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `verifiedAt` DATETIME(3) NULL,
    `verifiedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CreatorPayout_userId_key`(`userId`),
    INDEX `CreatorPayout_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
