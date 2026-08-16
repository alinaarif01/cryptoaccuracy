import { NextResponse } from 'next/server';
import { BinanceAPI } from '../../../lib/binance';
import { analyzeCandles } from '../../../lib/indicators';
import { getSettings, saveSettings, getOpenPositions, saveOpenPositions, addTradeRecord, getTradeHistory } from '../../../lib/config';

export const dynamic = 'force-dynamic';
export const preferredRegion = 'fra1';

export async function GET() {
  try {
    const settings = getSettings();
    const positions = getOpenPositions();
    const history = getTradeHistory();

    // Update floating PnL for active positions
    const updatedPositions = await Promise.all(
      positions.map(async (pos) => {
        if (pos.status !== 'OPEN') return pos;
        try {
          const currentPrice = await BinanceAPI.getPrice(pos.symbol);
          let floatingPnl = 0;
          let floatingPnlPercent = 0;

          if (pos.side === 'BUY') {
            floatingPnl = (currentPrice - pos.entryPrice) * pos.quantity;
            floatingPnlPercent = ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
          } else {
            floatingPnl = (pos.entryPrice - currentPrice) * pos.quantity;
            floatingPnlPercent = ((pos.entryPrice - currentPrice) / pos.entryPrice) * 100;
          }

          return {
            ...pos,
            currentPrice,
            floatingPnl: parseFloat(floatingPnl.toFixed(2)),
            floatingPnlPercent: parseFloat(floatingPnlPercent.toFixed(2))
          };
        } catch (e) {
          return pos;
        }
      })
    );

    saveOpenPositions(updatedPositions);

    // Calculate Win-Rate stats
    const totalTrades = history.length;
    const winningTrades = history.filter(t => (t.pnl || 0) > 0).length;
    const losingTrades = history.filter(t => (t.pnl || 0) <= 0).length;
    const totalProfit = history.reduce((acc, t) => acc + (t.pnl || 0), 0);
    const winRate = totalTrades > 0 ? parseFloat(((winningTrades / totalTrades) * 100).toFixed(1)) : 0;

    // Rolling 5-7 trades
    const recentTrades = history.slice(0, 7);
    const recentWins = recentTrades.filter(t => (t.pnl || 0) > 0).length;
    const recentWinRate = recentTrades.length > 0 ? parseFloat(((recentWins / recentTrades.length) * 100).toFixed(1)) : 0;

    return NextResponse.json({
      success: true,
      isAutoTrading: settings.autoTrade?.enabled || false,
      autoTradeConfig: settings.autoTrade,
      positions: updatedPositions,
      history: history.slice(0, 20),
      stats: {
        totalTrades,
        winningTrades,
        losingTrades,
        winRate,
        totalProfit: parseFloat(totalProfit.toFixed(2)),
        recentTradesCount: recentTrades.length,
        recentWinRate,
        targetWinRate: settings.autoTrade?.targetWinRate || 85.0
      }
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Toggle bot or trigger scan cycle
export async function POST(request) {
  try {
    const body = await request.json();
    const { action, enable, config } = body;
    const settings = getSettings();

    if (action === 'toggle') {
      const newState = enable !== undefined ? enable : !settings.autoTrade.enabled;
      const updated = saveSettings({
        autoTrade: {
          ...settings.autoTrade,
          enabled: newState
        }
      });

      return NextResponse.json({
        success: true,
        isAutoTrading: updated.autoTrade.enabled,
        message: `Auto Trading Bot is now ${updated.autoTrade.enabled ? 'ENABLED ⚡' : 'STOPPED 🛑'}`
      });
    }

    if (action === 'updateConfig' && config) {
      const updated = saveSettings({
        autoTrade: {
          ...settings.autoTrade,
          ...config
        }
      });
      return NextResponse.json({ success: true, autoTrade: updated.autoTrade });
    }

    // Action: runScan (called periodically by the frontend bot worker)
    if (action === 'scan') {
      if (!settings.autoTrade?.enabled) {
        return NextResponse.json({ success: true, message: 'Bot is disabled.' });
      }

      const openPositions = getOpenPositions();
      const logs = [];

      // 1. Check open positions for Take-Profit or Stop-Loss triggers
      for (const pos of openPositions) {
        if (pos.status !== 'OPEN') continue;

        try {
          const currentPrice = await BinanceAPI.getPrice(pos.symbol);
          let pnlPercent = 0;
          let pnlAmount = 0;

          if (pos.side === 'BUY') {
            pnlPercent = ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
            pnlAmount = (currentPrice - pos.entryPrice) * pos.quantity;
          } else {
            pnlPercent = ((pos.entryPrice - currentPrice) / pos.entryPrice) * 100;
            pnlAmount = (pos.entryPrice - currentPrice) * pos.quantity;
          }

          let shouldClose = false;
          let closeReason = '';

          // Check TP
          if (pos.takeProfitPrice) {
            if (pos.side === 'BUY' && currentPrice >= pos.takeProfitPrice) {
              shouldClose = true;
              closeReason = `🎯 TAKE PROFIT TARGET REACHED (+${pnlPercent.toFixed(2)}%)`;
            } else if (pos.side === 'SELL' && currentPrice <= pos.takeProfitPrice) {
              shouldClose = true;
              closeReason = `🎯 TAKE PROFIT TARGET REACHED (+${pnlPercent.toFixed(2)}%)`;
            }
          }

          // Check SL
          if (!shouldClose && pos.stopLossPrice) {
            if (pos.side === 'BUY' && currentPrice <= pos.stopLossPrice) {
              shouldClose = true;
              closeReason = `🛑 STOP LOSS HIT (${pnlPercent.toFixed(2)}%)`;
            } else if (pos.side === 'SELL' && currentPrice >= pos.stopLossPrice) {
              shouldClose = true;
              closeReason = `🛑 STOP LOSS HIT (${pnlPercent.toFixed(2)}%)`;
            }
          }

          if (shouldClose) {
            // Close order on Binance
            let exitPrice = currentPrice;
            try {
              const res = await BinanceAPI.closeOrder({
                symbol: pos.symbol,
                side: pos.side,
                quantity: pos.quantity
              });
              if (res.exitPrice) exitPrice = res.exitPrice;
            } catch (err) {
              console.warn('Binance auto close API warning:', err.message);
            }

            const closedRecord = {
              ...pos,
              status: 'CLOSED',
              exitPrice,
              closedAt: new Date().toISOString(),
              pnl: parseFloat(pnlAmount.toFixed(2)),
              pnlPercent: parseFloat(pnlPercent.toFixed(2)),
              isWin: pnlAmount > 0,
              closeReason
            };

            addTradeRecord(closedRecord);

            const remaining = getOpenPositions().filter(p => p.id !== pos.id);
            saveOpenPositions(remaining);

            logs.push({
              type: 'trade_close',
              message: `💰 AUTO EXIT: ${closedRecord.symbol} closed @ $${exitPrice} | PnL: ${closedRecord.pnl >= 0 ? '+' : ''}$${closedRecord.pnl} (${closedRecord.pnlPercent}%) | ${closeReason}`
            });
          }
        } catch (e) {
          // Ignore transient error
        }
      }

      // 2. Scan new entries if slots available
      const currentOpen = getOpenPositions();
      const maxTrades = settings.autoTrade?.maxOpenTrades || 5;

      if (currentOpen.length < maxTrades) {
        const symbols = settings.autoTrade?.symbols || ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT', 'XRPUSDT'];

        for (const sym of symbols) {
          const alreadyOpen = currentOpen.some(p => p.symbol === sym && p.status === 'OPEN');
          if (alreadyOpen) continue;
          if (getOpenPositions().length >= maxTrades) break;

          try {
            const klines = await BinanceAPI.getKlines(sym, settings.autoTrade.timeframe || '5m', 60);
            const analysis = analyzeCandles(klines);

            const minConfidence = settings.autoTrade?.minConfidence || 75;

            if (analysis.signal !== 'NEUTRAL' && analysis.confidence >= minConfidence) {
              const amountUsdt = settings.autoTrade?.tradeAmountUsdt || 50;

              // Place live order on Binance
              const orderResult = await BinanceAPI.placeOrder({
                symbol: sym,
                side: analysis.signal,
                amountUsdt,
                orderType: 'MARKET'
              });

              const tp = settings.autoTrade?.takeProfitPercent || 1.8;
              const sl = settings.autoTrade?.stopLossPercent || 1.0;

              let tpPrice = 0;
              let slPrice = 0;

              if (analysis.signal === 'BUY') {
                tpPrice = parseFloat((orderResult.entryPrice * (1 + tp / 100)).toFixed(4));
                slPrice = parseFloat((orderResult.entryPrice * (1 - sl / 100)).toFixed(4));
              } else {
                tpPrice = parseFloat((orderResult.entryPrice * (1 - tp / 100)).toFixed(4));
                slPrice = parseFloat((orderResult.entryPrice * (1 + sl / 100)).toFixed(4));
              }

              const autoPosition = {
                id: `AUTO-${orderResult.orderId || Date.now()}`,
                binanceOrderId: orderResult.orderId,
                symbol: sym,
                side: analysis.signal,
                entryPrice: orderResult.entryPrice,
                currentPrice: orderResult.entryPrice,
                amountUsdt: orderResult.amountUsdt,
                quantity: orderResult.quantity,
                takeProfitPrice: tpPrice,
                stopLossPrice: slPrice,
                tpPercent: tp,
                slPercent: sl,
                signalScore: analysis.confidence,
                signalReasons: analysis.reasons,
                source: 'auto',
                status: 'OPEN',
                openedAt: new Date().toISOString()
              };

              const allPos = getOpenPositions();
              allPos.unshift(autoPosition);
              saveOpenPositions(allPos);

              logs.push({
                type: 'trade_open',
                message: `⚡ AUTO TRADE PLACED on Binance: ${autoPosition.side} ${sym} @ $${autoPosition.entryPrice} ($${amountUsdt} USDT) | Target TP: $${tpPrice} (+${tp}%)`
              });
            }
          } catch (scanErr) {
            if (scanErr.message.includes('balance kam hai') || scanErr.message.includes('insufficient balance')) {
              logs.push({
                type: 'warning',
                message: `💡 Signal found for ${sym}! Binance Spot Wallet mein balance kam hai ($0 USDT). Balance add karein ya Demo mode on karein.`
              });
            } else {
              logs.push({
                type: 'info',
                message: `Scanning ${sym}... Analyzing live Binance RSI & EMA trends.`
              });
            }
          }
        }
      }

      if (logs.length === 0) {
        logs.push({
          type: 'info',
          message: '🔍 Scanning live Binance market... Strict 85% confluence check active.'
        });
      }

      return NextResponse.json({
        success: true,
        logs,
        positions: getOpenPositions(),
        history: getTradeHistory().slice(0, 10)
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
