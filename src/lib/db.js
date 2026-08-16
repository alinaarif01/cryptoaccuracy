import mysql from 'mysql2/promise';

/**
 * =========================================================================
 * MYSQL DATABASE CONNECTION POOL & ORM REPOSITORY
 * =========================================================================
 */

let pool = null;

export function getMySQLPool() {
  if (!pool) {
    const connectionUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;

    if (connectionUrl) {
      pool = mysql.createPool(connectionUrl);
    } else {
      pool = mysql.createPool({
        host: process.env.MYSQL_HOST || '127.0.0.1',
        port: parseInt(process.env.MYSQL_PORT || '3306', 10),
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'cryptoaccuracy',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined
      });
    }
  }
  return pool;
}

// 1. Automatic Schema Initialization on Startup
export async function initDatabase() {
  try {
    const db = getMySQLPool();

    // Create Trades Table
    await db.query(`
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
        INDEX idx_symbol (symbol)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Create Settings Table
    await db.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        setting_key VARCHAR(50) PRIMARY KEY,
        setting_value JSON NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    return true;
  } catch (error) {
    console.warn('MySQL Initialization Notice:', error.message);
    return false;
  }
}

// 2. Insert or Update Live Position in MySQL
export async function savePositionToMySQL(pos) {
  try {
    const db = getMySQLPool();
    await db.query(`
      INSERT INTO trades (
        id, binance_order_id, symbol, side, entry_price, amount_usdt, quantity,
        take_profit_price, stop_loss_price, tp_percent, sl_percent, source, status, opened_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', NOW())
      ON DUPLICATE KEY UPDATE
        floating_pnl = VALUES(floating_pnl),
        floating_pnl_percent = VALUES(floating_pnl_percent)
    `, [
      pos.id,
      pos.binanceOrderId || null,
      pos.symbol,
      pos.side,
      pos.entryPrice,
      pos.amountUsdt,
      pos.quantity,
      pos.takeProfitPrice || null,
      pos.stopLossPrice || null,
      pos.tpPercent || 1.8,
      pos.slPercent || 1.0,
      pos.source || 'manual'
    ]);
    return true;
  } catch (e) {
    console.warn('MySQL savePosition error:', e.message);
    return false;
  }
}

// 3. Query All Active OPEN Positions from MySQL
export async function getOpenPositionsFromMySQL() {
  try {
    const db = getMySQLPool();
    const [rows] = await db.query(`
      SELECT 
        id, binance_order_id AS binanceOrderId, symbol, side,
        entry_price AS entryPrice, amount_usdt AS amountUsdt, quantity,
        take_profit_price AS takeProfitPrice, stop_loss_price AS stopLossPrice,
        tp_percent AS tpPercent, sl_percent AS slPercent,
        floating_pnl AS floatingPnl, floating_pnl_percent AS floatingPnlPercent,
        source, status, opened_at AS openedAt
      FROM trades
      WHERE status = 'OPEN'
      ORDER BY opened_at DESC
    `);
    return rows;
  } catch (e) {
    return [];
  }
}

// 4. Close Trade in MySQL (Set status = 'CLOSED', pnl, exitPrice, closed_at)
export async function closePositionInMySQL(id, { exitPrice, pnl, pnlPercent, closeReason }) {
  try {
    const db = getMySQLPool();
    await db.query(`
      UPDATE trades 
      SET 
        status = 'CLOSED',
        exit_price = ?,
        pnl = ?,
        pnl_percent = ?,
        is_win = ?,
        close_reason = ?,
        closed_at = NOW()
      WHERE id = ? OR symbol = ? AND status = 'OPEN'
    `, [
      exitPrice,
      pnl,
      pnlPercent,
      pnl > 0 ? 1 : 0,
      closeReason || 'Manual / Auto Exit',
      id,
      id
    ]);
    return true;
  } catch (e) {
    console.warn('MySQL closePosition error:', e.message);
    return false;
  }
}

// 5. Query Completed Trade History from MySQL
export async function getTradeHistoryFromMySQL(limit = 50) {
  try {
    const db = getMySQLPool();
    const [rows] = await db.query(`
      SELECT 
        id, binance_order_id AS binanceOrderId, symbol, side,
        entry_price AS entryPrice, exit_price AS exitPrice,
        amount_usdt AS amountUsdt, quantity,
        pnl, pnl_percent AS pnlPercent, is_win AS isWin,
        source, status, close_reason AS closeReason,
        opened_at AS openedAt, closed_at AS closedAt
      FROM trades
      WHERE status = 'CLOSED'
      ORDER BY closed_at DESC
      LIMIT ?
    `, [limit]);
    return rows;
  } catch (e) {
    return [];
  }
}
