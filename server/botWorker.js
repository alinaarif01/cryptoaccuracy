const config = require('./config');
const binanceClient = require('./binanceClient');
const strategyEngine = require('./strategyEngine');

class BotWorker {
  constructor() {
    this.intervalId = null;
    this.isScanning = false;
    this.wsBroadcast = null;
    this.logHistory = [];
  }

  setBroadcaster(broadcaster) {
    this.wsBroadcast = broadcaster;
  }

  log(message, type = 'info', meta = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type, // 'info' | 'success' | 'warning' | 'error' | 'trade'
      message,
      meta
    };
    this.logHistory.unshift(logEntry);
    if (this.logHistory.length > 200) {
      this.logHistory.pop();
    }
    if (this.wsBroadcast) {
      this.wsBroadcast({ type: 'BOT_LOG', data: logEntry });
    }
    console.log(`[BOT ${type.toUpperCase()}] ${message}`);
  }

  getLogs() {
    return this.logHistory.slice(0, 50);
  }

  start() {
    const settings = config.getSettings();
    settings.autoTrade.enabled = true;
    config.saveSettings(settings);

    if (this.intervalId) clearInterval(this.intervalId);

    this.log(`🚀 Auto-Trading Bot STARTED. Scanning coins: ${settings.autoTrade.symbols.join(', ')}`, 'success');
    this.log(`🎯 Strategy: Confluence Scalper | Target Win Rate: ${settings.autoTrade.targetWinRate}% | Min Confidence: ${settings.autoTrade.minConfidence}%`, 'info');

    // Run immediate scan, then every 6 seconds
    this.runScanCycle();
    this.intervalId = setInterval(() => this.runScanCycle(), 6000);
  }

  stop() {
    const settings = config.getSettings();
    settings.autoTrade.enabled = false;
    config.saveSettings(settings);

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.log('🛑 Auto-Trading Bot STOPPED by user.', 'warning');
  }

  isRunning() {
    const settings = config.getSettings();
    return !!settings.autoTrade.enabled && !!this.intervalId;
  }

  async runScanCycle() {
    if (this.isScanning) return;
    this.isScanning = true;

    try {
      // 1. Check and manage currently open positions (auto-exit when TP / SL hit)
      await this.checkOpenPositions();

      // 2. Scan for new high-accuracy trade entries if capacity allows
      const settings = config.getSettings();
      if (!settings.autoTrade.enabled) return;

      const openPositions = config.getOpenPositions();
      if (openPositions.length >= settings.autoTrade.maxOpenTrades) {
        // Max concurrent trades reached
        return;
      }

      const symbols = settings.autoTrade.symbols || ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT', 'XRPUSDT'];

      for (const symbol of symbols) {
        // Don't open duplicate trades on same symbol
        const alreadyOpen = openPositions.some(p => p.symbol === symbol && p.status === 'OPEN');
        if (alreadyOpen) continue;

        // Check if we reached limit in this iteration
        if (config.getOpenPositions().length >= settings.autoTrade.maxOpenTrades) break;

        await this.evaluateSymbol(symbol);
      }
    } catch (err) {
      this.log(`Error during scan cycle: ${err.message}`, 'error');
    } finally {
      this.isScanning = false;
    }
  }

  async evaluateSymbol(symbol) {
    const settings = config.getSettings();
    try {
      const klines = await binanceClient.getKlines(symbol, settings.autoTrade.timeframe || '5m', 60);
      if (!klines || klines.length < 30) return;

      const analysis = strategyEngine.analyzeMarket(klines);
      
      // Check if signal meets confidence threshold
      if (analysis.signal !== 'NEUTRAL' && analysis.confidence >= settings.autoTrade.minConfidence) {
        this.log(`💡 High-Probability Signal for ${symbol}: ${analysis.signal} (Score: ${analysis.confidence}%). Reasons: ${analysis.reasons.join(', ')}`, 'info', { symbol, analysis });

        // Place Auto Trade
        const amountUsdt = settings.autoTrade.tradeAmountUsdt || 50;
        const newTrade = await binanceClient.executeOrder({
          symbol,
          side: analysis.signal, // 'BUY'
          amountUsdt,
          orderType: 'MARKET',
          tradeSource: 'auto'
        });

        // Set TP and SL prices
        const tpPercent = settings.autoTrade.takeProfitPercent || 1.8;
        const slPercent = settings.autoTrade.stopLossPercent || 1.0;

        let targetTpPrice = 0;
        let targetSlPrice = 0;

        if (newTrade.side === 'BUY') {
          targetTpPrice = newTrade.entryPrice * (1 + tpPercent / 100);
          targetSlPrice = newTrade.entryPrice * (1 - slPercent / 100);
        } else {
          targetTpPrice = newTrade.entryPrice * (1 - tpPercent / 100);
          targetSlPrice = newTrade.entryPrice * (1 + slPercent / 100);
        }

        newTrade.takeProfitPrice = parseFloat(targetTpPrice.toFixed(4));
        newTrade.stopLossPrice = parseFloat(targetSlPrice.toFixed(4));
        newTrade.tpPercent = tpPercent;
        newTrade.slPercent = slPercent;
        newTrade.signalScore = analysis.confidence;
        newTrade.signalReasons = analysis.reasons;

        const currentPositions = config.getOpenPositions();
        currentPositions.unshift(newTrade);
        config.saveOpenPositions(currentPositions);

        this.log(`⚡ AUTO TRADE OPENED: ${newTrade.side} ${symbol} @ $${newTrade.entryPrice.toLocaleString()} ($${amountUsdt} USDT) | Target TP: $${newTrade.takeProfitPrice.toLocaleString()} (+${tpPercent}%)`, 'trade', newTrade);

        if (this.wsBroadcast) {
          this.wsBroadcast({ type: 'POSITIONS_UPDATED', data: currentPositions });
        }
      }
    } catch (err) {
      this.log(`Failed to evaluate ${symbol}: ${err.message}`, 'error');
    }
  }

  async checkOpenPositions() {
    const openPositions = config.getOpenPositions();
    if (!openPositions || openPositions.length === 0) return;

    const remainingPositions = [];

    for (const position of openPositions) {
      if (position.status !== 'OPEN') continue;

      try {
        const currentPrice = await binanceClient.getPrice(position.symbol);
        let pnlPercent = 0;
        let pnlAmount = 0;

        if (position.side === 'BUY') {
          pnlPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
          pnlAmount = (currentPrice - position.entryPrice) * position.quantity;
        } else {
          pnlPercent = ((position.entryPrice - currentPrice) / position.entryPrice) * 100;
          pnlAmount = (position.entryPrice - currentPrice) * position.quantity;
        }

        let shouldClose = false;
        let closeReason = '';

        // Take Profit triggered
        if (position.takeProfitPrice) {
          if (position.side === 'BUY' && currentPrice >= position.takeProfitPrice) {
            shouldClose = true;
            closeReason = `🎯 TAKE PROFIT TARGET REACHED (+${pnlPercent.toFixed(2)}%)`;
          } else if (position.side === 'SELL' && currentPrice <= position.takeProfitPrice) {
            shouldClose = true;
            closeReason = `🎯 TAKE PROFIT TARGET REACHED (+${pnlPercent.toFixed(2)}%)`;
          }
        }

        // Stop Loss triggered
        if (!shouldClose && position.stopLossPrice) {
          if (position.side === 'BUY' && currentPrice <= position.stopLossPrice) {
            shouldClose = true;
            closeReason = `🛑 STOP LOSS HIT (${pnlPercent.toFixed(2)}%)`;
          } else if (position.side === 'SELL' && currentPrice >= position.stopLossPrice) {
            shouldClose = true;
            closeReason = `🛑 STOP LOSS HIT (${pnlPercent.toFixed(2)}%)`;
          }
        }

        if (shouldClose) {
          const closedPosition = await binanceClient.closePosition(position, currentPrice);
          closedPosition.closeReason = closeReason;

          config.addTradeRecord(closedPosition);

          const isProfit = closedPosition.pnl >= 0;
          this.log(
            `💰 AUTO EXIT: ${closedPosition.symbol} closed @ $${currentPrice.toLocaleString()} | PnL: ${isProfit ? '+' : ''}$${closedPosition.pnl.toFixed(2)} (${isProfit ? '+' : ''}${closedPosition.pnlPercent.toFixed(2)}%) | ${closeReason}`,
            isProfit ? 'success' : 'warning',
            closedPosition
          );
        } else {
          // Keep position active with live floating metrics
          position.currentPrice = currentPrice;
          position.floatingPnl = parseFloat(pnlAmount.toFixed(2));
          position.floatingPnlPercent = parseFloat(pnlPercent.toFixed(2));
          remainingPositions.push(position);
        }
      } catch (err) {
        remainingPositions.push(position);
      }
    }

    config.saveOpenPositions(remainingPositions);
    if (this.wsBroadcast) {
      this.wsBroadcast({ type: 'POSITIONS_UPDATED', data: remainingPositions });
    }
  }
}

module.exports = new BotWorker();
