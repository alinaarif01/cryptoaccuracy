'use client';

import React, { useState } from 'react';
import { Zap, Target, Cpu } from 'lucide-react';

export default function AutoTradePanel({
  isAutoTrading,
  onToggleAutoTrade,
  stats,
  autoTradeConfig,
  onSaveConfig
}) {
  const [tradeAmount, setTradeAmount] = useState(autoTradeConfig?.tradeAmountUsdt || 50);
  const [tp, setTp] = useState(autoTradeConfig?.takeProfitPercent || 1.8);
  const [sl, setSl] = useState(autoTradeConfig?.stopLossPercent || 1.0);
  const [confidence, setConfidence] = useState(autoTradeConfig?.minConfidence || 75);
  const [showConfig, setShowConfig] = useState(false);

  const handleSave = () => {
    onSaveConfig({
      tradeAmountUsdt: tradeAmount,
      takeProfitPercent: tp,
      stopLossPercent: sl,
      minConfidence: confidence
    });
    setShowConfig(false);
  };

  const winRate = stats?.recentTradesCount >= 3 ? stats?.recentWinRate : (stats?.winRate || 0);

  return (
    <div className="panel-card auto-trade-panel">
      <div className="panel-header highlight-cyan">
        <div className="panel-title">
          <Zap size={18} color="var(--binance-gold)" />
          <h3>AUTO TRADING ENGINE</h3>
        </div>
        <div className="target-accuracy-pill">
          <span>🎯 85% PROFIT TARGET</span>
        </div>
      </div>

      <div className="auto-trade-body">
        {/* Master Switch */}
        <div className="master-switch-card">
          <div className="switch-info">
            <span className="switch-title">AUTONOMOUS BOT</span>
            <span
              className="switch-desc"
              style={{ color: isAutoTrading ? 'var(--primary-green)' : 'var(--text-muted)' }}
            >
              {isAutoTrading
                ? '⚡ BOT ACTIVE: Scanning RSI/EMA confluence & executing trades on Binance.'
                : 'Bot is currently IDLE. Turn ON for automatic trading.'}
            </span>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={isAutoTrading}
              onChange={(e) => onToggleAutoTrade(e.target.checked)}
            />
            <span className="slider"></span>
          </label>
        </div>

        {/* Bot Metrics */}
        <div className="bot-metrics-grid">
          <div className="metric-card">
            <span className="m-label">BATCH ACCURACY</span>
            <span className="m-val highlight">{winRate}%</span>
            <span className="m-sub">Target: 85%+</span>
          </div>
          <div className="metric-card">
            <span className="m-label">TOTAL PROFIT</span>
            <span className={`m-val ${(stats?.totalProfit || 0) >= 0 ? 'text-green' : 'text-red'}`}>
              {(stats?.totalProfit || 0) >= 0 ? '+' : ''}${(stats?.totalProfit || 0).toFixed(2)}
            </span>
            <span className="m-sub">{stats?.totalTrades || 0} Total Trades</span>
          </div>
          <div className="metric-card">
            <span className="m-label">STRATEGY</span>
            <span className="m-val-sm">RSI + EMA 9/21</span>
            <span className="m-sub">Confluence Scalper</span>
          </div>
        </div>

        {/* Auto Traded Pairs */}
        <div className="bot-coins-config">
          <span className="config-title">Auto-Traded Pairs:</span>
          <div className="bot-coin-tags">
            {['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT', 'XRPUSDT'].map((c) => (
              <span key={c} className="bot-tag active">
                {c.replace('USDT', '')}
              </span>
            ))}
          </div>
        </div>

        {/* Config Toggle */}
        <div style={{ marginTop: '4px' }}>
          <button
            type="button"
            className="btn-secondary"
            style={{ width: '100%', fontSize: '0.75rem', padding: '6px' }}
            onClick={() => setShowConfig(!showConfig)}
          >
            {showConfig ? '▲ Hide Bot Parameters' : '⚙️ Customize Strategy Parameters'}
          </button>

          {showConfig && (
            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                <label>Amount per Auto Trade ($):</label>
                <input
                  type="number"
                  value={tradeAmount}
                  onChange={(e) => setTradeAmount(parseFloat(e.target.value) || 10)}
                  style={{ width: '80px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: '#fff', padding: '4px', borderRadius: '6px', textAlign: 'right' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                <label>Take Profit Target (%):</label>
                <input
                  type="number"
                  value={tp}
                  onChange={(e) => setTp(parseFloat(e.target.value) || 0.5)}
                  step="0.1"
                  style={{ width: '80px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: '#fff', padding: '4px', borderRadius: '6px', textAlign: 'right' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                <label>Stop Loss Limit (%):</label>
                <input
                  type="number"
                  value={sl}
                  onChange={(e) => setSl(parseFloat(e.target.value) || 0.5)}
                  step="0.1"
                  style={{ width: '80px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: '#fff', padding: '4px', borderRadius: '6px', textAlign: 'right' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                <label>Min Signal Confidence (%):</label>
                <input
                  type="number"
                  value={confidence}
                  onChange={(e) => setConfidence(parseInt(e.target.value) || 75)}
                  min="50"
                  max="95"
                  style={{ width: '80px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: '#fff', padding: '4px', borderRadius: '6px', textAlign: 'right' }}
                />
              </div>
              <button
                type="button"
                className="btn-primary"
                style={{ fontSize: '0.75rem', padding: '6px', marginTop: '6px' }}
                onClick={handleSave}
              >
                Save Strategy Config
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
