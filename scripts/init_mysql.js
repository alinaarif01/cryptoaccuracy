const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function setupMySQL() {
  console.log('========================================================');
  console.log('🚀 INITIALIZING MYSQL DATABASE FOR CRYPTO ACCURACY');
  console.log('========================================================\n');

  const connectionUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;
  let connection;

  try {
    if (connectionUrl) {
      console.log('Connecting using MYSQL_URL / DATABASE_URL...');
      connection = await mysql.createConnection(connectionUrl);
    } else {
      const host = process.env.MYSQL_HOST || '127.0.0.1';
      const port = parseInt(process.env.MYSQL_PORT || '3306', 10);
      const user = process.env.MYSQL_USER || 'root';
      const password = process.env.MYSQL_PASSWORD || '';

      console.log(`Connecting to MySQL at ${host}:${port} as ${user}...`);
      connection = await mysql.createConnection({ host, port, user, password });

      // Create Database
      await connection.query('CREATE DATABASE IF NOT EXISTS `cryptoaccuracy` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
      console.log('✅ Database `cryptoaccuracy` created / confirmed.');
      await connection.query('USE `cryptoaccuracy`;');
    }

    // Create Trades Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS trades (
        id VARCHAR(100) PRIMARY KEY,
        binance_order_id VARCHAR(100) NULL,
        symbol VARCHAR(20) NOT NULL,
        side VARCHAR(10) NOT NULL,
        entry_price DECIMAL(18, 8) NOT NULL,
        exit_price DECIMAL(18, 8) NULL,
        amount_usdt DECIMAL(18, 4) NOT NULL,
        quantity DECIMAL(18, 8) NOT NULL,
        take_profit_price DECIMAL(18, 8) NULL,
        stop_loss_price DECIMAL(18, 8) NULL,
        tp_percent DECIMAL(5, 2) DEFAULT 1.80,
        sl_percent DECIMAL(5, 2) DEFAULT 1.00,
        floating_pnl DECIMAL(18, 4) DEFAULT 0.00,
        floating_pnl_percent DECIMAL(6, 2) DEFAULT 0.00,
        pnl DECIMAL(18, 4) NULL,
        pnl_percent DECIMAL(6, 2) NULL,
        is_win BOOLEAN DEFAULT FALSE,
        source VARCHAR(20) DEFAULT 'manual',
        status VARCHAR(20) DEFAULT 'OPEN',
        close_reason VARCHAR(255) NULL,
        opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        closed_at DATETIME NULL,
        INDEX idx_status (status),
        INDEX idx_symbol (symbol),
        INDEX idx_opened_at (opened_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ Table `trades` created successfully.');

    // Create System Settings Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        setting_key VARCHAR(50) PRIMARY KEY,
        setting_value JSON NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ Table `system_settings` created successfully.');

    console.log('\n========================================================');
    console.log('🎉 MYSQL DATABASE IS 100% READY AND CONNECTED!');
    console.log('========================================================');
    await connection.end();
  } catch (err) {
    console.error('❌ MySQL Setup Error:', err.message);
    console.log('\n💡 Note: Make sure MySQL server is running or provide valid MYSQL_URL in .env.local');
  }
}

setupMySQL();
