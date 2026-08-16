const axios = require('axios');
const ccxt = require('ccxt');
const config = require('./config');

const BINANCE_PUBLIC_API = 'https://api.binance.com/api/v3';
const BINANCE_FAPI = 'https://fapi.binance.com/fapi/v1';

class BinanceClient {
  constructor() {
    this.exchange = null;
    this.priceCache = new Map();
    this.initExchange();
  }

  initExchange() {
    const settings = config.getSettings();
    if (settings.mode === 'live' && settings.apiKey && settings.apiSecret) {
      this.exchange = new ccxt.binance({
        apiKey: settings.apiKey,
        secret: settings.apiSecret,
        enableRateLimit: true,
        options: { defaultType: 'spot' }
      });
    } else if (settings.mode === 'testnet' && settings.testnetApiKey) {
      this.exchange = new ccxt.binance({
        apiKey: settings.testnetApiKey,
        secret: settings.testnetApiSecret,
        enableRateLimit: true,
        options: { defaultType: 'spot' }
      });
      this.exchange.setSandboxMode(true);
    } else {
      this.exchange = null;
    }
  }

  // Get live price for single or multiple coins
  async getPrice(symbol = 'BTCUSDT') {
    const cleanSymbol = symbol.replace('/', '').toUpperCase();
    try {
      const res = await axios.get(`${BINANCE_PUBLIC_API}/ticker/price?symbol=${cleanSymbol}`, { timeout: 4000 });
      const price = parseFloat(res.data.price);
      this.priceCache.set(cleanSymbol, price);
      return price;
    } catch (err) {
      if (this.priceCache.has(cleanSymbol)) {
        return this.priceCache.get(cleanSymbol);
      }
      throw new Error(`Failed to fetch price for ${cleanSymbol}: ${err.message}`);
    }
  }

  // Get 24h ticker summary (price, % change, high, low, volume)
  async get24hTicker(symbol = 'BTCUSDT') {
    const cleanSymbol = symbol.replace('/', '').toUpperCase();
    try {
      const res = await axios.get(`${BINANCE_PUBLIC_API}/ticker/24hr?symbol=${cleanSymbol}`, { timeout: 5000 });
      return {
        symbol: cleanSymbol,
        price: parseFloat(res.data.lastPrice),
        changePercent: parseFloat(res.data.priceChangePercent),
        high: parseFloat(res.data.highPrice),
        low: parseFloat(res.data.lowPrice),
        volume: parseFloat(res.data.volume),
        quoteVolume: parseFloat(res.data.quoteVolume)
      };
    } catch (err) {
      return {
        symbol: cleanSymbol,
        price: this.priceCache.get(cleanSymbol) || 0,
        changePercent: 0,
        high: 0,
        low: 0,
        volume: 0,
        quoteVolume: 0
      };
    }
  }

  // Get popular tickers batch
  async getTopTickers(symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT', 'XRPUSDT', 'ADAUSDT', 'AVAXUSDT', 'NEARUSDT']) {
    try {
      const res = await axios.get(`${BINANCE_PUBLIC_API}/ticker/24hr`, { timeout: 6000 });
      const symbolMap = new Map();
      for (const item of res.data) {
        symbolMap.set(item.symbol, {
          symbol: item.symbol,
          price: parseFloat(item.lastPrice),
          changePercent: parseFloat(item.priceChangePercent),
          high: parseFloat(item.highPrice),
          low: parseFloat(item.lowPrice),
          volume: parseFloat(item.volume)
        });
      }
      return symbols.map(sym => symbolMap.get(sym) || { symbol: sym, price: 0, changePercent: 0 });
    } catch (err) {
      return symbols.map(sym => ({ symbol: sym, price: 0, changePercent: 0 }));
    }
  }

  // Get candlestick historical data for technical analysis
  async getKlines(symbol = 'BTCUSDT', interval = '5m', limit = 50) {
    const cleanSymbol = symbol.replace('/', '').toUpperCase();
    try {
      const res = await axios.get(`${BINANCE_PUBLIC_API}/klines`, {
        params: { symbol: cleanSymbol, interval, limit },
        timeout: 5000
      });
      // Kline array: [openTime, open, high, low, close, volume, closeTime, quoteAssetVolume, numberOfTrades, ...]
      return res.data;
    } catch (err) {
      console.error(`Error fetching klines for ${cleanSymbol}:`, err.message);
      return [];
    }
  }

  // Get current account balances
  async getBalance() {
    const settings = config.getSettings();
    if (settings.mode === 'paper') {
      return {
        mode: 'paper',
        usdt: settings.paperBalance,
        freeUsdt: settings.paperBalance,
        lockedUsdt: 0
      };
    }

    if (!this.exchange) {
      this.initExchange();
    }

    if (!this.exchange) {
      return {
        mode: settings.mode,
        error: 'API Keys not configured',
        usdt: 0,
        freeUsdt: 0,
        lockedUsdt: 0
      };
    }

    try {
      const balance = await this.exchange.fetchBalance();
      const usdt = balance.total['USDT'] || 0;
      const free = balance.free['USDT'] || 0;
      const used = balance.used['USDT'] || 0;
      return {
        mode: settings.mode,
        usdt: parseFloat(usdt.toFixed(2)),
        freeUsdt: parseFloat(free.toFixed(2)),
        lockedUsdt: parseFloat(used.toFixed(2))
      };
    } catch (err) {
      return {
        mode: settings.mode,
        error: err.message,
        usdt: 0,
        freeUsdt: 0,
        lockedUsdt: 0
      };
    }
  }

  // Execute an order (Manual or Auto)
  async executeOrder({ symbol, side, amountUsdt, orderType = 'MARKET', price = null, tradeSource = 'manual' }) {
    const settings = config.getSettings();
    const cleanSymbol = symbol.replace('/', '').toUpperCase();
    const currentPrice = await this.getPrice(cleanSymbol);
    const executionPrice = price || currentPrice;
    const quantity = amountUsdt / executionPrice;

    const tradeId = `TRD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    if (settings.mode === 'paper') {
      // In paper trading, check sufficient balance
      if (side === 'BUY' && settings.paperBalance < amountUsdt) {
        throw new Error(`Insufficient Paper USDT balance ($${settings.paperBalance.toFixed(2)} available, $${amountUsdt} needed)`);
      }

      if (side === 'BUY') {
        config.updatePaperBalance(-amountUsdt);
      }

      const orderRecord = {
        id: tradeId,
        symbol: cleanSymbol,
        side, // BUY or SELL
        type: orderType,
        source: tradeSource, // 'manual' or 'auto'
        status: 'OPEN',
        entryPrice: executionPrice,
        amountUsdt,
        quantity,
        entryTime: new Date().toISOString(),
        mode: 'paper'
      };

      return orderRecord;
    }

    // Live or Testnet exchange execution
    if (!this.exchange) {
      this.initExchange();
    }
    if (!this.exchange) {
      throw new Error(`Exchange client not configured for ${settings.mode} mode. Check API keys in Settings.`);
    }

    try {
      const symbolFormatted = cleanSymbol.replace('USDT', '/USDT');
      const ccxtSide = side.toLowerCase();
      let order;

      if (orderType === 'MARKET') {
        order = await this.exchange.createMarketOrder(symbolFormatted, ccxtSide, quantity);
      } else {
        order = await this.exchange.createLimitOrder(symbolFormatted, ccxtSide, quantity, executionPrice);
      }

      const realFillPrice = order.average || order.price || executionPrice;
      const filledAmount = (order.filled || quantity) * realFillPrice;

      return {
        id: order.id || tradeId,
        symbol: cleanSymbol,
        side,
        type: orderType,
        source: tradeSource,
        status: 'OPEN',
        entryPrice: realFillPrice,
        amountUsdt: filledAmount,
        quantity: order.filled || quantity,
        entryTime: new Date().toISOString(),
        binanceOrderId: order.id,
        mode: settings.mode
      };
    } catch (err) {
      console.error(`Order execution failed:`, err.message);
      throw new Error(`Binance API Error: ${err.message}`);
    }
  }

  // Close an active position
  async closePosition(position, exitPrice = null) {
    const settings = config.getSettings();
    const cleanSymbol = position.symbol;
    const currentPrice = exitPrice || await this.getPrice(cleanSymbol);
    const closeSide = position.side === 'BUY' ? 'SELL' : 'BUY';

    let pnl = 0;
    let pnlPercent = 0;

    if (position.side === 'BUY') {
      pnl = (currentPrice - position.entryPrice) * position.quantity;
      pnlPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
    } else {
      pnl = (position.entryPrice - currentPrice) * position.quantity;
      pnlPercent = ((position.entryPrice - currentPrice) / position.entryPrice) * 100;
    }

    if (settings.mode === 'paper') {
      const returnAmount = position.amountUsdt + pnl;
      config.updatePaperBalance(returnAmount);

      return {
        ...position,
        status: 'CLOSED',
        exitPrice: currentPrice,
        exitTime: new Date().toISOString(),
        pnl: parseFloat(pnl.toFixed(2)),
        pnlPercent: parseFloat(pnlPercent.toFixed(2)),
        isWin: pnl > 0
      };
    }

    // Live or Testnet close
    if (!this.exchange) {
      this.initExchange();
    }

    if (this.exchange) {
      try {
        const symbolFormatted = cleanSymbol.replace('USDT', '/USDT');
        await this.exchange.createMarketOrder(symbolFormatted, closeSide.toLowerCase(), position.quantity);
      } catch (err) {
        console.error(`Warning: Real order close failed on Binance (${err.message}). Recording local close.`);
      }
    }

    return {
      ...position,
      status: 'CLOSED',
      exitPrice: currentPrice,
      exitTime: new Date().toISOString(),
      pnl: parseFloat(pnl.toFixed(2)),
      pnlPercent: parseFloat(pnlPercent.toFixed(2)),
      isWin: pnl > 0
    };
  }
}

module.exports = new BinanceClient();
