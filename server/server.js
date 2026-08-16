const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');

const config = require('./config');
const binanceClient = require('./binanceClient');
const strategyEngine = require('./strategyEngine');
const botWorker = require('./botWorker');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// WebSocket broadcast helper
function broadcast(payload) {
  const msg = JSON.stringify(payload);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

botWorker.setBroadcaster(broadcast);

// WebSocket connection handling
wss.on('connection', (ws) => {
  // Send initial payload
  ws.send(JSON.stringify({
    type: 'INIT',
    data: {
      settings: config.getSettings(),
      positions: config.getOpenPositions(),
      isAutoTrading: botWorker.isRunning(),
      logs: botWorker.getLogs()
    }
  }));
});

// Periodic live price & position PnL broadcast loop
setInterval(async () => {
  if (wss.clients.size === 0) return;
  try {
    const settings = config.getSettings();
    const selectedSymbol = settings.selectedCoin || 'BTCUSDT';
    const popularSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT', 'XRPUSDT'];
    
    const topTickers = await binanceClient.getTopTickers(popularSymbols);
    const balance = await binanceClient.getBalance();
    const openPositions = config.getOpenPositions();

    // Update floating PnL for active positions
    for (const pos of openPositions) {
      if (pos.status === 'OPEN') {
        const livePrice = await binanceClient.getPrice(pos.symbol);
        pos.currentPrice = livePrice;
        if (pos.side === 'BUY') {
          pos.floatingPnl = parseFloat(((livePrice - pos.entryPrice) * pos.quantity).toFixed(2));
          pos.floatingPnlPercent = parseFloat((((livePrice - pos.entryPrice) / pos.entryPrice) * 100).toFixed(2));
        } else {
          pos.floatingPnl = parseFloat(((pos.entryPrice - livePrice) * pos.quantity).toFixed(2));
          pos.floatingPnlPercent = parseFloat((((pos.entryPrice - livePrice) / pos.entryPrice) * 100).toFixed(2));
        }
      }
    }
    config.saveOpenPositions(openPositions);

    broadcast({
      type: 'TICKER_UPDATE',
      data: {
        tickers: topTickers,
        balance,
        positions: openPositions,
        isAutoTrading: botWorker.isRunning()
      }
    });
  } catch (err) {
    // Ignore transient ticker error
  }
}, 2000);

// ==================== REST APIS ==================== //

// 1. System Status & Win-Rate Stats
app.get('/api/status', async (req, res) => {
  try {
    const settings = config.getSettings();
    const balance = await binanceClient.getBalance();
    const history = config.getTradeHistory();
    const openPositions = config.getOpenPositions();

    const totalTrades = history.length;
    const winningTrades = history.filter(t => t.pnl > 0).length;
    const losingTrades = history.filter(t => t.pnl <= 0).length;
    const totalProfit = history.reduce((acc, t) => acc + (t.pnl || 0), 0);
    const winRate = totalTrades > 0 ? parseFloat(((winningTrades / totalTrades) * 100).toFixed(1)) : 0;

    // Recent 5-7 trades metrics (as requested by user)
    const recentTrades = history.slice(0, 7);
    const recentWins = recentTrades.filter(t => t.pnl > 0).length;
    const recentWinRate = recentTrades.length > 0 ? parseFloat(((recentWins / recentTrades.length) * 100).toFixed(1)) : 0;
    const recentProfit = recentTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);

    res.json({
      success: true,
      mode: settings.mode,
      balance,
      isAutoTrading: botWorker.isRunning(),
      stats: {
        totalTrades,
        winningTrades,
        losingTrades,
        winRate,
        totalProfit: parseFloat(totalProfit.toFixed(2)),
        recentTradesCount: recentTrades.length,
        recentWinRate,
        recentProfit: parseFloat(recentProfit.toFixed(2)),
        targetWinRate: settings.autoTrade.targetWinRate || 85.0
      },
      openPositionsCount: openPositions.length
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Market Prices & Tickers
app.get('/api/tickers', async (req, res) => {
  try {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT', 'XRPUSDT', 'ADAUSDT', 'AVAXUSDT', 'NEARUSDT'];
    const tickers = await binanceClient.getTopTickers(symbols);
    res.json({ success: true, tickers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Single Coin 24h Ticker
app.get('/api/ticker/:symbol', async (req, res) => {
  try {
    const ticker = await binanceClient.get24hTicker(req.params.symbol);
    res.json({ success: true, ticker });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Kline (Candlestick) Chart Data
app.get('/api/klines/:symbol', async (req, res) => {
  try {
    const interval = req.query.interval || '5m';
    const limit = parseInt(req.query.limit) || 60;
    const klines = await binanceClient.getKlines(req.params.symbol, interval, limit);
    res.json({ success: true, klines });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Strategy Analysis for any coin
app.get('/api/analysis/:symbol', async (req, res) => {
  try {
    const interval = req.query.interval || '5m';
    const klines = await binanceClient.getKlines(req.params.symbol, interval, 60);
    const analysis = strategyEngine.analyzeMarket(klines);
    res.json({ success: true, symbol: req.params.symbol, analysis });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Manual Trade Start (User clicks START TRADE)
app.post('/api/trade/manual/start', async (req, res) => {
  try {
    const { symbol, side, amountUsdt, takeProfitPercent, stopLossPercent } = req.body;
    if (!symbol || !side || !amountUsdt) {
      return res.status(400).json({ success: false, error: 'symbol, side (BUY/SELL), and amountUsdt are required.' });
    }

    const trade = await binanceClient.executeOrder({
      symbol,
      side: side.toUpperCase(),
      amountUsdt: parseFloat(amountUsdt),
      orderType: 'MARKET',
      tradeSource: 'manual'
    });

    const tp = takeProfitPercent ? parseFloat(takeProfitPercent) : 2.0;
    const sl = stopLossPercent ? parseFloat(stopLossPercent) : 1.2;

    if (trade.side === 'BUY') {
      trade.takeProfitPrice = parseFloat((trade.entryPrice * (1 + tp / 100)).toFixed(4));
      trade.stopLossPrice = parseFloat((trade.entryPrice * (1 - sl / 100)).toFixed(4));
    } else {
      trade.takeProfitPrice = parseFloat((trade.entryPrice * (1 - tp / 100)).toFixed(4));
      trade.stopLossPrice = parseFloat((trade.entryPrice * (1 + sl / 100)).toFixed(4));
    }
    trade.tpPercent = tp;
    trade.slPercent = sl;

    const positions = config.getOpenPositions();
    positions.unshift(trade);
    config.saveOpenPositions(positions);

    botWorker.log(`🟢 MANUAL TRADE STARTED: ${trade.side} ${trade.symbol} @ $${trade.entryPrice.toLocaleString()} ($${amountUsdt} USDT)`, 'trade', trade);

    broadcast({ type: 'POSITIONS_UPDATED', data: positions });

    res.json({ success: true, trade, positions });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 7. Manual Trade Close (User clicks CLOSE TRADE)
app.post('/api/trade/manual/close', async (req, res) => {
  try {
    const { tradeId, symbol } = req.body;
    let positions = config.getOpenPositions();
    let targetPos = null;

    if (tradeId) {
      targetPos = positions.find(p => p.id === tradeId);
    } else if (symbol) {
      targetPos = positions.find(p => p.symbol === symbol.toUpperCase() && p.status === 'OPEN');
    } else if (positions.length > 0) {
      // Close latest open trade
      targetPos = positions[0];
    }

    if (!targetPos) {
      return res.status(404).json({ success: false, error: 'No active matching trade found to close.' });
    }

    const closed = await binanceClient.closePosition(targetPos);
    closed.closeReason = 'Manual User Close';
    config.addTradeRecord(closed);

    positions = positions.filter(p => p.id !== targetPos.id);
    config.saveOpenPositions(positions);

    const isWin = closed.pnl >= 0;
    botWorker.log(`🔴 MANUAL TRADE CLOSED: ${closed.symbol} @ $${closed.exitPrice.toLocaleString()} | PnL: ${isWin ? '+' : ''}$${closed.pnl} (${isWin ? '+' : ''}${closed.pnlPercent}%)`, isWin ? 'success' : 'warning', closed);

    broadcast({ type: 'POSITIONS_UPDATED', data: positions });

    res.json({ success: true, closedTrade: closed, positions });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 8. Auto-Trading Toggle (ON / OFF)
app.post('/api/auto-trade/toggle', (req, res) => {
  try {
    const { enable } = req.body;
    const shouldEnable = enable !== undefined ? enable : !botWorker.isRunning();

    if (shouldEnable) {
      botWorker.start();
    } else {
      botWorker.stop();
    }

    const isRunning = botWorker.isRunning();
    broadcast({ type: 'AUTOTRADE_TOGGLED', data: { isRunning } });

    res.json({ success: true, isAutoTrading: isRunning });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Update Auto-Trading Configuration
app.post('/api/auto-trade/config', (req, res) => {
  try {
    const current = config.getSettings();
    const updated = config.saveSettings({
      autoTrade: {
        ...current.autoTrade,
        ...req.body
      }
    });
    botWorker.log('⚙️ Auto-Trading configuration updated', 'info', updated.autoTrade);
    res.json({ success: true, autoTrade: updated.autoTrade });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 10. Open Positions
app.get('/api/positions', (req, res) => {
  res.json({ success: true, positions: config.getOpenPositions() });
});

// 11. Trade History
app.get('/api/history', (req, res) => {
  res.json({ success: true, history: config.getTradeHistory() });
});

// 12. Bot Logs
app.get('/api/logs', (req, res) => {
  res.json({ success: true, logs: botWorker.getLogs() });
});

// 13. Settings (API keys, Trading Mode)
app.get('/api/settings', (req, res) => {
  const s = config.getSettings();
  // Mask secrets for display
  res.json({
    success: true,
    settings: {
      ...s,
      apiSecret: s.apiSecret ? '••••••••' + s.apiSecret.slice(-4) : '',
      testnetApiSecret: s.testnetApiSecret ? '••••••••' + s.testnetApiSecret.slice(-4) : ''
    }
  });
});

app.post('/api/settings', (req, res) => {
  try {
    const updated = config.saveSettings(req.body);
    binanceClient.initExchange();
    botWorker.log(`⚙️ Trading Mode changed to: ${updated.mode.toUpperCase()}`, 'info');
    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Start Server
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Crypto Accuracy - Binance Trading System`);
  console.log(`🌐 Server running at: http://localhost:${PORT}`);
  console.log(`📊 Mode: ${config.getSettings().mode.toUpperCase()}`);
  console.log(`====================================================`);
});
