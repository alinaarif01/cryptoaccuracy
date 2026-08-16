'use client';

import React, { useState } from 'react';
import { Play, Square, ArrowUp, ArrowDown, Sparkles } from 'lucide-react';

export default function ManualTradePanel({
  selectedSymbol,
  availableBalance,
  onStartTrade,
  onCloseTrade,
  hasOpenPositionForCoin
}) {
  const [side, setSide] = useState('BUY');
  const [amount, setAmount] = useState(50);
  const [tpPercent, setTpPercent] = useState(1.8);
  const [slPercent, setSlPercent] = useState(1.0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleStart = async () => {
    if (amount <= 0) return;
    setIsSubmitting(true);
    try {
      await onStartTrade({
        symbol: selectedSymbol,
        side,
        amountUsdt: amount,
        takeProfitPercent: tpPercent,
        stopLossPercent: slPercent
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = async () => {
    setIsSubmitting(true);
    try {
      await onCloseTrade(selectedSymbol);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="panel-card manual-trade-panel">
      <div className="panel-header highlight-green">
        <div className="panel-title">
          <Sparkles size={18} color="var(--primary-green)" />
          <h3>MANUAL TRADE CONTROL</h3>
        </div>
        <span className="badge manual-badge">USER CONTROLLED</span>
      </div>

      <div className="manual-form">
        {/* BUY / SELL Switch */}
        <div className="direction-toggle">
          <button
            type="button"
            className={`direction-btn buy ${side === 'BUY' ? 'active' : ''}`}
            onClick={() => setSide('BUY')}
          >
            <ArrowUp size={16} /> BUY / LONG
          </button>
          <button
            type="button"
            className={`direction-btn sell ${side === 'SELL' ? 'active' : ''}`}
            onClick={() => setSide('SELL')}
          >
            <ArrowDown size={16} /> SELL / SHORT
          </button>
        </div>

        {/* Amount Input */}
        <div className="input-group">
          <div className="input-header">
            <label>Order Amount (USDT)</label>
            <span>
              Binance Free:{' '}
              <strong style={{ color: '#fff' }}>
                ${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </span>
          </div>
          <div className="input-with-affix">
            <span className="affix">$</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              min="5"
              step="5"
            />
            <span className="suffix">USDT</span>
          </div>
        </div>

        {/* Quick Amount Presets */}
        <div className="amount-presets">
          {[25, 50, 100, 250].map((val) => (
            <button
              key={val}
              type="button"
              className={`preset-btn ${amount === val ? 'active' : ''}`}
              onClick={() => setAmount(val)}
            >
              ${val}
            </button>
          ))}
          <button
            type="button"
            className="preset-btn"
            onClick={() => setAmount(Math.max(10, Math.floor(availableBalance * 0.5)))}
          >
            50% Max
          </button>
        </div>

        {/* TP & SL Percentages */}
        <div className="tp-sl-grid">
          <div className="tpsl-input-wrap">
            <label>🎯 Take Profit (%)</label>
            <input
              type="number"
              value={tpPercent}
              onChange={(e) => setTpPercent(parseFloat(e.target.value) || 0)}
              step="0.1"
              min="0.2"
            />
          </div>
          <div className="tpsl-input-wrap">
            <label>🛑 Stop Loss (%)</label>
            <input
              type="number"
              value={slPercent}
              onChange={(e) => setSlPercent(parseFloat(e.target.value) || 0)}
              step="0.1"
              min="0.2"
            />
          </div>
        </div>

        {/* 2 MAIN BUTTONS: START TRADE & CLOSE TRADE */}
        <div className="manual-actions-container">
          <button
            type="button"
            className="action-btn start-trade-btn"
            onClick={handleStart}
            disabled={isSubmitting}
          >
            <div className="btn-content">
              <span className="btn-title">🚀 START TRADE</span>
              <span className="btn-sub">Open Order on Binance</span>
            </div>
          </button>

          <button
            type="button"
            className="action-btn close-trade-btn"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            <div className="btn-content">
              <span className="btn-title">🛑 CLOSE TRADE</span>
              <span className="btn-sub">Exit {selectedSymbol.replace('USDT', '')} Position</span>
            </div>
          </button>
        </div>

        <div className="manual-status-note">
          Click <strong>START TRADE</strong> to execute order on Binance, and <strong>CLOSE TRADE</strong> to exit immediately.
        </div>
      </div>
    </div>
  );
}
