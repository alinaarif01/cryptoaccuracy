import crypto from 'crypto';
import axios from 'axios';
import { getSettings } from './config';

const BINANCE_PROD_URL = 'https://api.binance.com';
const BINANCE_TESTNET_URL = 'https://testnet.binance.vision';

export class BinanceAPI {
  static getBaseUrl() {
    const settings = getSettings();
    return settings.useTestnet ? BINANCE_TESTNET_URL : BINANCE_PROD_URL;
  }

  static getCredentials() {
    const settings = getSettings();
    return {
      apiKey: settings.apiKey || process.env.BINANCE_API_KEY || 'OCobwBkYlnYGWKMEbkhobnRYMs9mIMw8XgMuPwHRe6oWZ130PqF3gYqXNhiAbMRG',
      apiSecret: settings.apiSecret || process.env.BINANCE_API_SECRET || '0Lw5wOhDzwdDv1LY5NLqAFZnmXYbP3ajT5YdYRTrSBR7nJUULTwXJXpG50mxOVzT'
    };
  }

  // Create HMAC SHA-256 signature for signed endpoints
  static signQuery(queryString, apiSecret) {
    return crypto
      .createHmac('sha256', apiSecret)
      .update(queryString)
      .digest('hex');
  }

  // Public: Get live price for single symbol
  static async getPrice(symbol = 'BTCUSDT') {
    const cleanSymbol = symbol.replace(/[^A-Z0-9]/g, '').toUpperCase();
    const res = await axios.get(`${BINANCE_PROD_URL}/api/v3/ticker/price`, {
      params: { symbol: cleanSymbol },
      timeout: 4000
    });
    return parseFloat(res.data.price);
  }

  // Public: Get 24h market stats
  static async get24hTickers(symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT', 'XRPUSDT', 'ADAUSDT', 'AVAXUSDT']) {
    try {
      const res = await axios.get(`${BINANCE_PROD_URL}/api/v3/ticker/24hr`, { timeout: 5000 });
      const symbolMap = new Map();
      for (const item of res.data) {
        symbolMap.set(item.symbol, {
          symbol: item.symbol,
          price: parseFloat(item.lastPrice),
          changePercent: parseFloat(item.priceChangePercent),
          high: parseFloat(item.highPrice),
          low: parseFloat(item.lowPrice),
          volume: parseFloat(item.volume),
          quoteVolume: parseFloat(item.quoteVolume)
        });
      }
      return symbols.map(s => symbolMap.get(s) || { symbol: s, price: 0, changePercent: 0, high: 0, low: 0, volume: 0 });
    } catch (err) {
      console.error('Binance 24hr ticker error:', err.message);
      return symbols.map(s => ({ symbol: s, price: 0, changePercent: 0, high: 0, low: 0, volume: 0 }));
    }
  }

  // Public: Candlestick Kline history with fallback mirrors
  static async getKlines(symbol = 'BTCUSDT', interval = '5m', limit = 100) {
    const cleanSymbol = symbol.replace(/[^A-Z0-9]/g, '').toUpperCase();
    const mirrors = [
      'https://api.binance.com/api/v3/klines',
      'https://data-api.binance.vision/api/v3/klines',
      'https://api1.binance.com/api/v3/klines',
      'https://api2.binance.com/api/v3/klines'
    ];

    for (const url of mirrors) {
      try {
        const res = await axios.get(url, {
          params: { symbol: cleanSymbol, interval, limit },
          timeout: 4000
        });
        if (Array.isArray(res.data) && res.data.length > 0) {
          return res.data;
        }
      } catch (err) {
        // try next mirror
      }
    }
    throw new Error(`Failed to fetch klines for ${cleanSymbol} from Binance endpoints`);
  }

  // Public: Exchange Info (precision, min trade amounts)
  static async getSymbolFilters(symbol = 'BTCUSDT') {
    const cleanSymbol = symbol.replace(/[^A-Z0-9]/g, '').toUpperCase();
    try {
      const res = await axios.get(`${BINANCE_PROD_URL}/api/v3/exchangeInfo?symbol=${cleanSymbol}`);
      const symbolInfo = res.data.symbols[0];
      const lotSize = symbolInfo.filters.find(f => f.filterType === 'LOT_SIZE') || {};
      const minNotional = symbolInfo.filters.find(f => f.filterType === 'NOTIONAL' || f.filterType === 'MIN_NOTIONAL') || {};
      const priceFilter = symbolInfo.filters.find(f => f.filterType === 'PRICE_FILTER') || {};

      return {
        baseAsset: symbolInfo.baseAsset,
        quoteAsset: symbolInfo.quoteAsset,
        stepSize: parseFloat(lotSize.stepSize || '0.0001'),
        minQty: parseFloat(lotSize.minQty || '0.0001'),
        tickSize: parseFloat(priceFilter.tickSize || '0.01'),
        minNotional: parseFloat(minNotional.minNotional || '5.0')
      };
    } catch (e) {
      return { stepSize: 0.0001, minQty: 0.0001, tickSize: 0.01, minNotional: 5.0 };
    }
  }

  // Private Signed: Get Binance Account Balance
  static async getAccountBalance() {
    const { apiKey, apiSecret } = this.getCredentials();
    const settings = getSettings();

    if (!apiKey || !apiSecret) {
      return {
        isConfigured: false,
        mode: settings.useTestnet ? 'testnet' : 'live',
        usdt: 0,
        freeUsdt: 0,
        lockedUsdt: 0,
        balances: [],
        message: 'API Key and Secret Key not yet entered. Open Settings (⚙️) to connect.'
      };
    }

    try {
      const baseUrl = this.getBaseUrl();
      const timestamp = Date.now();
      const queryString = `timestamp=${timestamp}`;
      const signature = this.signQuery(queryString, apiSecret);

      const res = await axios.get(`${baseUrl}/api/v3/account?${queryString}&signature=${signature}`, {
        headers: {
          'X-MBX-APIKEY': apiKey
        },
        timeout: 5000
      });

      const balances = res.data.balances
        .filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
        .map(b => ({
          asset: b.asset,
          free: parseFloat(b.free),
          locked: parseFloat(b.locked),
          total: parseFloat(b.free) + parseFloat(b.locked)
        }));

      const usdtItem = balances.find(b => b.asset === 'USDT');
      const usdtTotal = usdtItem ? usdtItem.total : 0;
      const usdtFree = usdtItem ? usdtItem.free : 0;
      const usdtLocked = usdtItem ? usdtItem.locked : 0;

      return {
        isConfigured: true,
        mode: settings.useTestnet ? 'testnet' : 'live',
        canTrade: res.data.canTrade,
        usdt: parseFloat(usdtTotal.toFixed(2)),
        freeUsdt: parseFloat(usdtFree.toFixed(2)),
        lockedUsdt: parseFloat(usdtLocked.toFixed(2)),
        balances
      };
    } catch (err) {
      const errorMsg = err.response?.data?.msg || err.message;
      return {
        isConfigured: true,
        error: errorMsg,
        mode: settings.useTestnet ? 'testnet' : 'live',
        usdt: 0,
        freeUsdt: 0,
        lockedUsdt: 0,
        balances: []
      };
    }
  }

  // Private Signed: Place Order on Binance (BUY/SELL MARKET or LIMIT)
  static async placeOrder({ symbol, side, amountUsdt, orderType = 'MARKET', price = null }) {
    const { apiKey, apiSecret } = this.getCredentials();
    const settings = getSettings();
    const cleanSymbol = symbol.replace(/[^A-Z0-9]/g, '').toUpperCase();
    const currentPrice = await this.getPrice(cleanSymbol);
    const filter = await this.getSymbolFilters(cleanSymbol);

    // Calculate raw quantity and round according to stepSize
    const rawQty = amountUsdt / currentPrice;
    const precision = Math.max(0, Math.round(-Math.log10(filter.stepSize)));
    const quantity = parseFloat((Math.floor(rawQty / filter.stepSize) * filter.stepSize).toFixed(precision));

    // Simulation / Paper mode support
    if (settings.mode === 'paper' || !apiKey || !apiSecret) {
      return {
        orderId: `SIM-${Date.now()}`,
        clientOrderId: `SIM-CLI-${Date.now()}`,
        symbol: cleanSymbol,
        side: side.toUpperCase(),
        status: 'FILLED',
        entryPrice: currentPrice,
        quantity,
        amountUsdt,
        transactTime: Date.now(),
        isSimulated: true
      };
    }

    const baseUrl = this.getBaseUrl();
    const timestamp = Date.now();

    let queryParams = {
      symbol: cleanSymbol,
      side: side.toUpperCase(),
      type: orderType.toUpperCase(),
      timestamp
    };

    if (orderType === 'MARKET') {
      if (side.toUpperCase() === 'BUY') {
        queryParams.quoteOrderQty = parseFloat(amountUsdt.toFixed(2));
      } else {
        queryParams.quantity = quantity;
      }
    } else {
      queryParams.quantity = quantity;
      queryParams.price = price || currentPrice;
      queryParams.timeInForce = 'GTC';
    }

    const queryString = Object.entries(queryParams)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');

    const signature = this.signQuery(queryString, apiSecret);
    const fullUrl = `${baseUrl}/api/v3/order?${queryString}&signature=${signature}`;

    try {
      const res = await axios.post(fullUrl, null, {
        headers: { 'X-MBX-APIKEY': apiKey },
        timeout: 7000
      });

      const fillPrice = res.data.fills?.length > 0
        ? res.data.fills.reduce((acc, f) => acc + parseFloat(f.price) * parseFloat(f.qty), 0) /
          res.data.fills.reduce((acc, f) => acc + parseFloat(f.qty), 0)
        : (parseFloat(res.data.price) || currentPrice);

      const executedQty = parseFloat(res.data.executedQty) || quantity;
      const totalAmountUsdt = fillPrice * executedQty;

      return {
        orderId: res.data.orderId,
        clientOrderId: res.data.clientOrderId,
        symbol: cleanSymbol,
        side: side.toUpperCase(),
        status: res.data.status,
        entryPrice: fillPrice,
        quantity: executedQty,
        amountUsdt: totalAmountUsdt,
        transactTime: res.data.transactTime || Date.now(),
        raw: res.data
      };
    } catch (err) {
      const code = err.response?.data?.code;
      const rawMsg = err.response?.data?.msg || err.message;

      let userFriendlyMsg = rawMsg;

      if (code === -2010 || rawMsg.includes('insufficient balance')) {
        userFriendlyMsg = `Binance Spot Wallet mein balance kam hai (Available $0 USDT). Trade open karne ke liye Spot wallet mein USDT transfer karein.`;
      } else if (code === -1013 || rawMsg.includes('MIN_NOTIONAL')) {
        userFriendlyMsg = `Order amount $${amountUsdt} kam hai. Binance par minimum trade $5 ya $10 USDT ki hoti hai.`;
      } else if (code === -2015 || rawMsg.includes('permissions')) {
        userFriendlyMsg = `API Permission Error: Binance API Management mein 'Enable Spot & Margin Trading' permission ON karein.`;
      } else if (code === -1021 || rawMsg.includes('Timestamp')) {
        userFriendlyMsg = `Time Synchronization Error: Binance server ke sath time sync ho raha hai, please dubara try karein.`;
      } else if (code === -1003 || rawMsg.includes('TOO_MANY_REQUESTS')) {
        userFriendlyMsg = `Binance rate limit reached. Thori dair baad dubara try karein.`;
      }

      throw new Error(userFriendlyMsg);
    }
  }

  // Private Signed: Close active position via reverse market order
  static async closeOrder({ symbol, side, quantity }) {
    const { apiKey, apiSecret } = this.getCredentials();
    const settings = getSettings();
    const cleanSymbol = symbol.replace(/[^A-Z0-9]/g, '').toUpperCase();
    const closeSide = side.toUpperCase() === 'BUY' ? 'SELL' : 'BUY';
    const currentPrice = await this.getPrice(cleanSymbol);

    if (settings.mode === 'paper' || !apiKey || !apiSecret) {
      return {
        orderId: `SIM-CLOSE-${Date.now()}`,
        symbol: cleanSymbol,
        exitPrice: currentPrice,
        status: 'FILLED',
        executedQty: quantity
      };
    }

    const precision = Math.max(0, Math.round(-Math.log10(filter.stepSize)));
    const cleanQty = parseFloat((Math.floor(quantity / filter.stepSize) * filter.stepSize).toFixed(precision));

    const baseUrl = this.getBaseUrl();
    const timestamp = Date.now();

    const queryParams = {
      symbol: cleanSymbol,
      side: closeSide,
      type: 'MARKET',
      quantity: cleanQty,
      timestamp
    };

    const queryString = Object.entries(queryParams)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');

    const signature = this.signQuery(queryString, apiSecret);
    const fullUrl = `${baseUrl}/api/v3/order?${queryString}&signature=${signature}`;

    const res = await axios.post(fullUrl, null, {
      headers: { 'X-MBX-APIKEY': apiKey },
      timeout: 7000
    });

    const exitPrice = res.data.fills?.length > 0
      ? res.data.fills.reduce((acc, f) => acc + parseFloat(f.price) * parseFloat(f.qty), 0) /
        res.data.fills.reduce((acc, f) => acc + parseFloat(f.qty), 0)
      : await this.getPrice(cleanSymbol);

    return {
      orderId: res.data.orderId,
      symbol: cleanSymbol,
      exitPrice,
      status: res.data.status,
      executedQty: cleanQty
    };
  }

  // Private Signed: Fetch live open orders directly from Binance
  static async getOpenOrders(symbol = null) {
    const { apiKey, apiSecret } = this.getCredentials();
    if (!apiKey || !apiSecret) return [];

    const baseUrl = this.getBaseUrl();
    const timestamp = Date.now();
    let query = `timestamp=${timestamp}`;
    if (symbol) query += `&symbol=${symbol.toUpperCase()}`;

    const signature = this.signQuery(query, apiSecret);
    const fullUrl = `${baseUrl}/api/v3/openOrders?${query}&signature=${signature}`;

    try {
      const res = await axios.get(fullUrl, {
        headers: { 'X-MBX-APIKEY': apiKey },
        timeout: 6000
      });
      return res.data;
    } catch (e) {
      return [];
    }
  }

  // Private Signed: Fetch all historical orders directly from Binance
  static async getAllOrders(symbol = 'BTCUSDT', limit = 20) {
    const { apiKey, apiSecret } = this.getCredentials();
    if (!apiKey || !apiSecret) return [];

    const baseUrl = this.getBaseUrl();
    const timestamp = Date.now();
    const query = `symbol=${symbol.toUpperCase()}&limit=${limit}&timestamp=${timestamp}`;
    const signature = this.signQuery(query, apiSecret);
    const fullUrl = `${baseUrl}/api/v3/allOrders?${query}&signature=${signature}`;

    try {
      const res = await axios.get(fullUrl, {
        headers: { 'X-MBX-APIKEY': apiKey },
        timeout: 6000
      });
      return res.data;
    } catch (e) {
      return [];
    }
  }
}
