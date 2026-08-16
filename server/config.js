const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const POSITIONS_FILE = path.join(DATA_DIR, 'positions.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Default system configurations
const defaultSettings = {
  mode: 'paper', // 'paper' | 'testnet' | 'live'
  apiKey: '',
  apiSecret: '',
  testnetApiKey: '',
  testnetApiSecret: '',
  paperBalance: 10000.00, // Initial virtual USDT for safe testing
  selectedCoin: 'BTCUSDT',
  manualTradeAmount: 50, // default USDT per manual trade
  autoTrade: {
    enabled: false,
    symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT', 'XRPUSDT'],
    tradeAmountUsdt: 50,
    takeProfitPercent: 1.8, // % per trade
    stopLossPercent: 1.0,  // % per trade
    maxOpenTrades: 5,
    targetWinRate: 85.0,   // Target win rate target (%)
    timeframe: '5m',
    minConfidence: 75,     // Minimum indicator confluence score (0-100)
    strategy: 'momentum_rsi_ema'
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

let settings = loadJSON(SETTINGS_FILE, defaultSettings);
let tradeHistory = loadJSON(HISTORY_FILE, { trades: [] });
let openPositions = loadJSON(POSITIONS_FILE, { positions: [] });

module.exports = {
  getSettings: () => settings,
  saveSettings: (newSettings) => {
    settings = { ...settings, ...newSettings, autoTrade: { ...settings.autoTrade, ...(newSettings.autoTrade || {}) } };
    saveJSON(SETTINGS_FILE, settings);
    return settings;
  },
  getTradeHistory: () => tradeHistory.trades || [],
  addTradeRecord: (record) => {
    if (!tradeHistory.trades) tradeHistory.trades = [];
    tradeHistory.trades.unshift(record);
    saveJSON(HISTORY_FILE, tradeHistory);
    return tradeHistory.trades;
  },
  getOpenPositions: () => openPositions.positions || [],
  saveOpenPositions: (positions) => {
    openPositions.positions = positions;
    saveJSON(POSITIONS_FILE, openPositions);
    return openPositions.positions;
  },
  updatePaperBalance: (delta) => {
    settings.paperBalance = parseFloat((settings.paperBalance + delta).toFixed(2));
    saveJSON(SETTINGS_FILE, settings);
    return settings.paperBalance;
  }
};
