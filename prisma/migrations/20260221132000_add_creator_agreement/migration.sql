-- Add creator agreement fields for publish pre-sign flow
ALTER TABLE `User`
  ADD COLUMN `creatorAgreementAcceptedAt` DATETIME(3) NULL,
  ADD COLUMN `creatorAgreementVersion` VARCHAR(191) NULL,
  ADD COLUMN `creatorAgreementIp` VARCHAR(191) NULL,
  ADD COLUMN `creatorAgreementUserAgent` VARCHAR(191) NULL,
  ADD COLUMN `creatorAgreementSnapshot` TEXT NULL;
