-- MySQL 5.7 compatible: add displayNo columns and unique indexes idempotently
SET @db := DATABASE();

-- 1) User.displayNo
SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='User' AND COLUMN_NAME='displayNo'
);
SET @sql := IF(@exists=0,
  'ALTER TABLE `User` ADD COLUMN `displayNo` VARCHAR(32) NULL;',
  'SELECT 1;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) Order.displayNo
SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='Order' AND COLUMN_NAME='displayNo'
);
SET @sql := IF(@exists=0,
  'ALTER TABLE `Order` ADD COLUMN `displayNo` VARCHAR(32) NULL;',
  'SELECT 1;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) OrderRefund.displayNo
SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='OrderRefund' AND COLUMN_NAME='displayNo'
);
SET @sql := IF(@exists=0,
  'ALTER TABLE `OrderRefund` ADD COLUMN `displayNo` VARCHAR(32) NULL;',
  'SELECT 1;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4) unique indexes (create only when missing)
SET @idx_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='User' AND INDEX_NAME='User_displayNo_key'
);
SET @sql := IF(@idx_exists=0,
  'CREATE UNIQUE INDEX `User_displayNo_key` ON `User`(`displayNo`);',
  'SELECT 1;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='Order' AND INDEX_NAME='Order_displayNo_key'
);
SET @sql := IF(@idx_exists=0,
  'CREATE UNIQUE INDEX `Order_displayNo_key` ON `Order`(`displayNo`);',
  'SELECT 1;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='OrderRefund' AND INDEX_NAME='OrderRefund_displayNo_key'
);
SET @sql := IF(@idx_exists=0,
  'CREATE UNIQUE INDEX `OrderRefund_displayNo_key` ON `OrderRefund`(`displayNo`);',
  'SELECT 1;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
