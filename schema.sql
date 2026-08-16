-- =========================================================
-- CRYPTO ACCURACY - MYSQL DATABASE SCHEMA
-- =========================================================

CREATE DATABASE IF NOT EXISTS `cryptoaccuracy` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `cryptoaccuracy`;

-- 1. Trades & Orders Table (Manual & Auto Execution Logs)
CREATE TABLE IF NOT EXISTS `trades` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `binance_order_id` VARCHAR(100) DEFAULT NULL,
  `symbol` VARCHAR(20) NOT NULL,
  `side` VARCHAR(10) NOT NULL,
  `entry_price` DECIMAL(18, 8) NOT NULL,
  `exit_price` DECIMAL(18, 8) DEFAULT NULL,
  `amount_usdt` DECIMAL(18, 4) NOT NULL,
  `quantity` DECIMAL(18, 8) NOT NULL,
  `take_profit_price` DECIMAL(18, 8) DEFAULT NULL,
  `stop_loss_price` DECIMAL(18, 8) DEFAULT NULL,
  `tp_percent` DECIMAL(5, 2) DEFAULT 1.80,
  `sl_percent` DECIMAL(5, 2) DEFAULT 1.00,
  `floating_pnl` DECIMAL(18, 4) DEFAULT 0.00,
  `floating_pnl_percent` DECIMAL(6, 2) DEFAULT 0.00,
  `pnl` DECIMAL(18, 4) DEFAULT NULL,
  `pnl_percent` DECIMAL(6, 2) DEFAULT NULL,
  `is_win` TINYINT(1) DEFAULT 0,
  `source` VARCHAR(20) DEFAULT 'manual',
  `status` VARCHAR(20) DEFAULT 'OPEN',
  `close_reason` VARCHAR(255) DEFAULT NULL,
  `opened_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `closed_at` DATETIME DEFAULT NULL,
  INDEX `idx_status` (`status`),
  INDEX `idx_symbol` (`symbol`),
  INDEX `idx_opened_at` (`opened_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. System Settings Table
CREATE TABLE IF NOT EXISTS `system_settings` (
  `setting_key` VARCHAR(50) NOT NULL PRIMARY KEY,
  `setting_value` JSON NOT NULL,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
