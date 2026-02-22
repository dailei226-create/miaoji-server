-- Batch 2A-1: Order management fields parity (minimal risk)
-- Only add missing columns/tables. No data backfill.
-- NOTE: This file is intended to be executed on the server:
--   MYSQL_PWD=... mysql -u root miaoji < /tmp/batch2a1_order_align.sql

-- 1) Add missing admin/shipping columns to `Order` (all NULLable)
ALTER TABLE `Order`
  ADD COLUMN `expressCompany` VARCHAR(191) NULL,
  ADD COLUMN `expressNo` VARCHAR(191) NULL,
  ADD COLUMN `shippedAt` DATETIME(3) NULL,
  ADD COLUMN `receivedAt` DATETIME(3) NULL,
  ADD COLUMN `completedAt` DATETIME(3) NULL,
  ADD COLUMN `adminNote` TEXT NULL;

-- 2) Create missing tables for schema parity (minimal). Avoid FK for minimal risk.
CREATE TABLE IF NOT EXISTS `OrderOpLog` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `action` VARCHAR(191) NOT NULL,
  `payloadJson` JSON NULL,
  `adminId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `OrderOpLog_orderId_createdAt_idx`(`orderId`, `createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `OrderRefund` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL,
  `reason` TEXT NULL,
  `requestNote` TEXT NULL,
  `decisionNote` TEXT NULL,
  `decidedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `OrderRefund_orderId_key`(`orderId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SELECT 'BATCH2A1_OK' AS result;
