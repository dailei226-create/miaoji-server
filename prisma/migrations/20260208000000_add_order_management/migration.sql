-- AlterEnum
ALTER TABLE `Order` MODIFY COLUMN `status` ENUM('created', 'paid', 'shipped', 'completed', 'canceled', 'refund_requested', 'refund_approved', 'refund_rejected', 'refunded') NOT NULL DEFAULT 'created';

-- AlterTable
ALTER TABLE `Order` ADD COLUMN `expressCompany` VARCHAR(191) NULL,
ADD COLUMN `expressNo` VARCHAR(191) NULL,
ADD COLUMN `shippedAt` DATETIME(3) NULL,
ADD COLUMN `completedAt` DATETIME(3) NULL,
ADD COLUMN `adminNote` TEXT NULL;

-- CreateTable
CREATE TABLE `OrderOpLog` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `payloadJson` JSON NULL,
    `adminId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OrderOpLog_orderId_createdAt_idx`(`orderId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderRefund` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `reason` TEXT NULL,
    `requestNote` TEXT NULL,
    `decisionNote` TEXT NULL,
    `decidedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `OrderRefund_orderId_key`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `OrderOpLog` ADD CONSTRAINT `OrderOpLog_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderRefund` ADD CONSTRAINT `OrderRefund_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
