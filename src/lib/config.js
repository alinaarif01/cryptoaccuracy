import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const ENV_FILE = path.join(process.cwd(), '.env.local');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const defaultSettings = {
  mode: 'live', // 'live' | 'testnet' | 'paper'
  apiKey: process.env.BINANCE_API_KEY || 'UrRgxXFMD7sL0umV7u8LEU943pJ6cbPU1STAW8x0g3uJ2zaCRhRScTGZUZwJAbOX',
  apiSecret: process.env.BINANCE_API_SECRET || 'L1ffOIr6IAC8wCUwWQ0gBzjVEPrDHlf8XWKtEu7npoRsJXHkMvAGBS5nnxoAgOSG',
  useTestnet: process.env.BINANCE_USE_TESTNET === 'true',
  paperBalance: 10000.00,
  selectedCoin: 'BTCUSDT',
  manualTradeAmount: 50,
  autoTrade: {
    enabled: false,
    symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT', 'XRPUSDT'],
    tradeAmountUsdt: 50,
    takeProfitPercent: 1.8,
    stopLossPercent: 1.0,
    maxOpenTrades: 5,
    targetWinRate: 85.0,
    timeframe: '5m',
    minConfidence: 75
  }
};

function loadJSON(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return { ...fallback, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
  }
  return fallback;
}

function saveJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err.message);
    return false;
  }
}

// Update .env.local file whenever settings are saved
export function syncToEnvLocal(apiKey, apiSecret, useTestnet) {
  try {
    let content = `# ==========================================\n# BINANCE API CONFIGURATION (REAL ACCOUNT)\n# ==========================================\n`;
    content += `BINANCE_API_KEY=${apiKey || ''}\n`;
    content += `BINANCE_API_SECRET=${apiSecret || ''}\n`;
    content += `BINANCE_USE_TESTNET=${useTestnet ? 'true' : 'false'}\n`;
    content += `NEXT_PUBLIC_DEFAULT_COIN=BTCUSDT\n`;
    fs.writeFileSync(ENV_FILE, content, 'utf8');
  } catch (e) {
    console.error('Failed to sync to .env.local:', e.message);
  }
}

export function getSettings() {
  const current = loadJSON(SETTINGS_FILE, defaultSettings);
  // Fallback to env vars if empty in json
  if (!current.apiKey && process.env.BINANCE_API_KEY) {
    current.apiKey = process.env.BINANCE_API_KEY;
  }
  if (!current.apiSecret && process.env.BINANCE_API_SECRET) {
    current.apiSecret = process.env.BINANCE_API_SECRET;
  }
  return current;
}

export function saveSettings(newSettings) {
  const current = getSettings();
  const merged = {
    ...current,
    ...newSettings,
    autoTrade: { ...current.autoTrade, ...(newSettings.autoTrade || {}) }
  };
  saveJSON(SETTINGS_FILE, merged);

  // Sync to .env.local
  if (newSettings.apiKey !== undefined || newSettings.apiSecret !== undefined || newSettings.useTestnet !== undefined) {
    syncToEnvLocal(merged.apiKey, merged.apiSecret, merged.useTestnet);
  }

  return merged;
}

export function getTradeHistory() {
  const data = loadJSON(HISTORY_FILE, { trades: [] });
  return data.trades || [];
}

export function addTradeRecord(record) {
  const data = loadJSON(HISTORY_FILE, { trades: [] });
  if (!data.trades) data.trades = [];
  data.trades.unshift(record);
  saveJSON(HISTORY_FILE, data);
  return data.trades;
}

let memoryPositions = [];

export function getOpenPositions() {
  return memoryPositions;
}

export function saveOpenPositions(positions) {
  memoryPositions = positions || [];
  return memoryPositions;
}
