-- MySQL 5.7 compatible displayNo columns backfill migration (idempotent)
SET @db := DATABASE();

-- 1) OrderRefund.displayNo (18)
SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='OrderRefund' AND COLUMN_NAME='displayNo'
);
SET @sql := IF(@exists=0,
  'ALTER TABLE `OrderRefund` ADD COLUMN `displayNo` VARCHAR(18) NULL;',
  'SELECT 1;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) Order.displayNo (18)
SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='Order' AND COLUMN_NAME='displayNo'
);
SET @sql := IF(@exists=0,
  'ALTER TABLE `Order` ADD COLUMN `displayNo` VARCHAR(18) NULL;',
  'SELECT 1;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) User.displayNo (12)
SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='User' AND COLUMN_NAME='displayNo'
);
SET @sql := IF(@exists=0,
  'ALTER TABLE `User` ADD COLUMN `displayNo` VARCHAR(12) NULL;',
  'SELECT 1;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
