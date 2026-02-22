-- Add missing Notice / Support tables for runtime parity
-- Keep DDL idempotent to reduce production risk

CREATE TABLE IF NOT EXISTS `Notice` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` VARCHAR(191) NOT NULL,
  `type` VARCHAR(191) NOT NULL DEFAULT 'system',
  `title` VARCHAR(191) NOT NULL,
  `content` TEXT NOT NULL,
  `workId` VARCHAR(191) NULL,
  `isRead` BOOLEAN NOT NULL DEFAULT false,
  `readAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `Notice_userId_isRead_idx`(`userId`, `isRead`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SupportTicket` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `status` ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
  `lastMessageAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `SupportTicket_userId_status_idx`(`userId`, `status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SupportMessage` (
  `id` VARCHAR(191) NOT NULL,
  `ticketId` VARCHAR(191) NOT NULL,
  `senderType` ENUM('USER', 'ADMIN') NOT NULL,
  `senderId` VARCHAR(191) NULL,
  `content` TEXT NOT NULL,
  `readAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `SupportMessage_ticketId_createdAt_idx`(`ticketId`, `createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `SupportMessage`
  ADD CONSTRAINT `SupportMessage_ticketId_fkey`
  FOREIGN KEY (`ticketId`) REFERENCES `SupportTicket`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
