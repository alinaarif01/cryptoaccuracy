'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Zap, Sliders, ShieldCheck, ArrowUp, ArrowDown } from 'lucide-react';
import SettingsModal from '../components/SettingsModal';

const COINS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT', 'XRPUSDT'];

export default function CleanTradingApp() {
  const [tradingMode, setTradingMode] = useState('paper'); // 'paper' (Demo) | 'live'
  const [selectedCoin, setSelectedCoin] = useState('BTCUSDT');
  const [coinPrices, setCoinPrices] = useState({});
  const [tradeSide, setTradeSide] = useState('BUY');
  const [tradeAmount, setTradeAmount] = useState(50);
  const [priceMode, setPriceMode] = useState('MARKET'); // 'MARKET' | 'CUSTOM'
  const [customPrice, setCustomPrice] = useState('');
  const [isAutoTrading, setIsAutoTrading] = useState(false);
  const [openPositions, setOpenPositions] = useState([]);
  const [botStatusText, setBotStatusText] = useState('Auto trading is currently OFF.');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [orderError, setOrderError] = useState(null);

  const scanTimerRef = useRef(null);

  const showToast = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const handleToggleMode = async (mode) => {
    setTradingMode(mode);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });
      showToast(`Trading Mode switched to: ${mode === 'paper' ? '🛡️ Demo Practice Mode ($10,000 USDT)' : '🔥 Live Binance Account'}`, 'success');
    } catch (e) {}
  };

  const [liveAnalysis, setLiveAnalysis] = useState(null);

  // Fetch Live Binance Indicator Confluence for selected coin
  useEffect(() => {
    const fetchCoinAnalysis = async () => {
      try {
        const res = await fetch(`/api/binance/analysis?symbol=${selectedCoin}&interval=5m`);
        const data = await res.json();
        if (data.success && data.analysis) {
          setLiveAnalysis(data.analysis);
        }
      } catch (e) {}
    };

    fetchCoinAnalysis();
    const interval = setInterval(fetchCoinAnalysis, 5000);
    return () => clearInterval(interval);
  }, [selectedCoin]);

  // 1. Direct Binance Live WebSocket Stream for Selected Coins
  useEffect(() => {
    const streamNames = COINS.map((c) => `${c.toLowerCase()}@ticker`).join('/');
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${streamNames}`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data && data.s) {
          setCoinPrices((prev) => ({
            ...prev,
            [data.s]: {
              price: parseFloat(data.c),
              change: parseFloat(data.P)
            }
          }));
        }
      } catch (e) {}
    };

    return () => ws.close();
  }, []);

  const [liveBalance, setLiveBalance] = useState({ usdt: 0, loading: true });
  const [tradeHistory, setTradeHistory] = useState([]);

  // Fetch Live Real Binance Balance from API
  const fetchLiveBalance = async () => {
    try {
      const res = await fetch('/api/binance/account');
      const data = await res.json();
      if (data.success) {
        setLiveBalance({ usdt: data.usdt || data.freeUsdt || 0, loading: false });
      } else {
        setLiveBalance({ usdt: 0, loading: false });
      }
    } catch (e) {
      setLiveBalance({ usdt: 0, loading: false });
    }
  };

  // Load persistent trade history on mount
  useEffect(() => {
    fetchLiveBalance();
    const balanceInterval = setInterval(fetchLiveBalance, 10000);

    try {
      const saved = localStorage.getItem('binance_trade_db');
      if (saved) setTradeHistory(JSON.parse(saved));
    } catch (e) {}

    return () => clearInterval(balanceInterval);
  }, []);

  const saveTradeToDb = (newTrade) => {
    setTradeHistory((prev) => {
      const updated = [newTrade, ...prev].slice(0, 50);
      try {
        localStorage.setItem('binance_trade_db', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  // 3. Auto Trading Bot Loop
  useEffect(() => {
    if (isAutoTrading) {
      setBotStatusText('🔍 Scanning live Binance market... (Evaluating RSI & EMA confluence for 85% profit setup)');
      runAutoTradeCycle();
      scanTimerRef.current = setInterval(runAutoTradeCycle, 6000);
    } else {
      setBotStatusText('Auto trading is currently OFF. Click button below to activate.');
      if (scanTimerRef.current) clearInterval(scanTimerRef.current);
    }
    return () => {
      if (scanTimerRef.current) clearInterval(scanTimerRef.current);
    };
  }, [isAutoTrading]);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/bot');
      const data = await res.json();
      if (data.success) {
        setOpenPositions(data.positions || []);
      }
    } catch (e) {}
  };

  const runAutoTradeCycle = async () => {
    try {
      const res = await fetch('/api/bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan' })
      });
      const data = await res.json();
      if (data.success) {
        if (data.positions) setOpenPositions(data.positions);
        if (data.logs && data.logs.length > 0) {
          const lastLog = data.logs[0];
          setBotStatusText(lastLog.message);
          showToast(lastLog.message, 'info');
        }
      }
    } catch (e) {}
  };

  // MANUAL: START TRADE on Binance
  const handleStartManualTrade = async () => {
    setLoading(true);
    setOrderError(null);
    try {
      const payload = {
        symbol: selectedCoin,
        side: tradeSide,
        amountUsdt: tradeAmount,
        orderType: priceMode === 'CUSTOM' ? 'LIMIT' : 'MARKET',
        price: priceMode === 'CUSTOM' ? parseFloat(customPrice || coinPrices[selectedCoin]?.price) : null
      };

      const res = await fetch('/api/binance/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setOrderError(null);
        showToast(`🚀 ${tradeSide} ${selectedCoin} Order Placed (${priceMode === 'CUSTOM' ? 'Limit @ $' + payload.price : 'Market Price'})`, 'success');
        setOpenPositions(data.positions || []);

        if (data.position) {
          saveTradeToDb({
            id: data.position.id || `BIN-${Date.now()}`,
            symbol: selectedCoin,
            side: tradeSide,
            price: data.position.entryPrice || payload.price || coinPrices[selectedCoin]?.price,
            amountUsdt: tradeAmount,
            type: payload.orderType,
            status: 'EXECUTED',
            time: new Date().toLocaleTimeString()
          });
        }
        fetchLiveBalance();
      } else {
        setOrderError(data.error);
        showToast(`❌ Error: ${data.error}`, 'error');
      }
    } catch (err) {
      setOrderError(err.message);
      showToast(`Network Error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // MANUAL: CLOSE TRADE on Binance
  const handleCloseManualTrade = async () => {
    setLoading(true);
    setOrderError(null);
    try {
      const res = await fetch('/api/binance/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: selectedCoin })
      });
      const data = await res.json();
      if (data.success) {
        setOrderError(null);
        const pnl = data.closedTrade?.pnl || 0;
        showToast(`🛑 Trade Closed on Binance: ${selectedCoin} | PnL: $${pnl}`, pnl >= 0 ? 'success' : 'info');
        setOpenPositions(data.positions || []);

        saveTradeToDb({
          id: `CLOSE-${Date.now()}`,
          symbol: selectedCoin,
          side: 'CLOSE',
          price: data.closedTrade?.exitPrice || coinPrices[selectedCoin]?.price,
          amountUsdt: tradeAmount,
          pnl,
          status: 'CLOSED',
          time: new Date().toLocaleTimeString()
        });
        fetchLiveBalance();
      } else {
        setOrderError(data.error);
        showToast(`❌ Error: ${data.error}`, 'error');
      }
    } catch (err) {
      setOrderError(err.message);
      showToast(`Network Error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // AUTO: TOGGLE AUTO TRADING
  const handleToggleAutoTrade = async () => {
    try {
      const nextState = !isAutoTrading;
      const res = await fetch('/api/bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', enable: nextState })
      });
      const data = await res.json();
      if (data.success) {
        setIsAutoTrading(data.isAutoTrading);
        showToast(data.message, data.isAutoTrading ? 'success' : 'info');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  };

  const currentPrice = coinPrices[selectedCoin]?.price || 0;
  const currentChange = coinPrices[selectedCoin]?.change || 0;

  return (
    <div className="clean-container">
      {/* Top Header */}
      <div className="clean-header">
        <div className="clean-brand">
          <span className="brand-dot"></span>
          <h2>BINANCE LIVE TRADING</h2>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{
            background: 'rgba(240,185,11,0.12)',
            border: '1px solid rgba(240,185,11,0.35)',
            color: 'var(--binance-gold)',
            fontSize: '0.74rem',
            fontWeight: '800',
            padding: '4px 10px',
            borderRadius: '20px'
          }}>
            💰 Binance Balance: {liveBalance.loading ? 'Loading...' : `$${liveBalance.usdt.toFixed(2)} USDT`}
          </span>
          <span className="live-status-tag">🔥 REAL ACCOUNT</span>
          <button className="clean-settings-btn" onClick={() => setIsSettingsOpen(true)}>
            <Sliders size={16} />
            <span>API Settings</span>
          </button>
        </div>
      </div>

      {/* 1. COIN SELECTION SECTION */}
      <div className="clean-card">
        <label className="card-label">1. SELECT COIN TO TRADE</label>
        <div className="coin-buttons-grid">
          {COINS.map((c) => {
            const isSelected = c === selectedCoin;
            const price = coinPrices[c]?.price;
            const change = coinPrices[c]?.change || 0;
            const isPos = change >= 0;

            return (
              <button
                key={c}
                className={`clean-coin-btn ${isSelected ? 'active' : ''}`}
                onClick={() => setSelectedCoin(c)}
              >
                <span className="coin-title">{c.replace('USDT', '')}</span>
                <span className="coin-p">
                  {price ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : '$--'}
                </span>
                <span className={`coin-c ${isPos ? 'pos' : 'neg'}`}>
                  {isPos ? '+' : ''}{change.toFixed(2)}%
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Coin Banner + Live Binance Indicator Confluence */}
        <div className="selected-banner" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className="sub-lbl">Active Pair:</span>
              <strong className="hl-coin">{selectedCoin.replace('USDT', '/USDT')}</strong>
            </div>
            <div>
              <span className="sub-lbl">Live Binance Price:</span>
              <strong className="hl-price">
                ${currentPrice ? currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '0.00'}
              </strong>
            </div>
          </div>

          {/* Real-time Indicator Confluence Live from Binance */}
          {liveAnalysis && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '8px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              fontSize: '0.75rem',
              color: 'var(--text-muted)'
            }}>
              <div>
                <span>Live RSI (14): </span>
                <strong style={{ color: liveAnalysis.rsi > 60 ? 'var(--primary-green)' : liveAnalysis.rsi < 40 ? 'var(--danger-red)' : '#fff' }}>
                  {liveAnalysis.rsi ? liveAnalysis.rsi.toFixed(1) : '--'}
                </strong>
              </div>
              <div>
                <span>EMA 9/21: </span>
                <strong style={{ color: liveAnalysis.ema9 > liveAnalysis.ema21 ? 'var(--primary-green)' : 'var(--danger-red)' }}>
                  {liveAnalysis.ema9 > liveAnalysis.ema21 ? 'Bullish ↑' : 'Bearish ↓'}
                </strong>
              </div>
              <div>
                <span>MACD: </span>
                <strong style={{ color: liveAnalysis.macd && liveAnalysis.macd.histogram >= 0 ? 'var(--primary-green)' : 'var(--danger-red)' }}>
                  {liveAnalysis.macd ? (liveAnalysis.macd.histogram >= 0 ? '+Bullish' : '-Bearish') : '--'}
                </strong>
              </div>
              <div>
                <span>Live Signal Score: </span>
                <strong style={{ color: 'var(--binance-gold)' }}>
                  {liveAnalysis.confidence || 0}% ({liveAnalysis.signal || 'NEUTRAL'})
                </strong>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. MANUAL TRADING SECTION */}
      <div className="clean-card">
        <label className="card-label">2. MANUAL TRADING (USER CONTROLLED)</label>
        
        {/* BUY / SELL Direction + Amount in USDT */}
        <div className="trade-inputs-row">
          {/* BUY / SELL Switch */}
          <div className="side-switch">
            <button
              className={`side-btn buy ${tradeSide === 'BUY' ? 'active' : ''}`}
              onClick={() => setTradeSide('BUY')}
            >
              <ArrowUp size={16} /> BUY
            </button>
            <button
              className={`side-btn sell ${tradeSide === 'SELL' ? 'active' : ''}`}
              onClick={() => setTradeSide('SELL')}
            >
              <ArrowDown size={16} /> SELL
            </button>
          </div>

          {/* Amount in USDT */}
          <div className="amount-input-box">
            <span className="usdt-prefix">$</span>
            <input
              type="number"
              value={tradeAmount}
              onChange={(e) => setTradeAmount(parseFloat(e.target.value) || 10)}
              min="5"
              step="5"
              placeholder="Amount USDT"
            />
            <span className="usdt-suffix">USDT</span>
          </div>
        </div>

        {/* 2 MAIN BUTTONS: START TRADE & CLOSE TRADE */}
        <div className="trade-actions-grid" style={{ marginTop: '16px' }}>
          <button
            className="btn-start-trade"
            onClick={handleStartManualTrade}
            disabled={loading}
          >
            <Play size={20} fill="#000" />
            <span>START TRADE ({tradeSide})</span>
          </button>

          <button
            className="btn-close-trade"
            onClick={handleCloseManualTrade}
            disabled={loading}
          >
            <Square size={20} fill="#fff" />
            <span>CLOSE TRADE</span>
          </button>
        </div>

        {/* Actionable Error Banner if Trade Fails */}
        {orderError && (
          <div style={{
            marginTop: '14px',
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: 'rgba(255, 59, 105, 0.12)',
            border: '1px solid rgba(255, 59, 105, 0.35)',
            color: '#ff4d6d',
            fontSize: '0.82rem',
            lineHeight: '1.4',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>⚠️</span>
            <strong>{orderError}</strong>
          </div>
        )}
      </div>

      {/* 3. AUTO TRADING SECTION (85% Profit Target) */}
      <div className="clean-card auto-card">
        <div className="auto-card-top">
          <div>
            <label className="card-label">3. AUTO TRADING ENGINE</label>
            <p className="auto-sub-text">Autonomous Algorithmic Trading (85% Target Win-Rate Strategy)</p>
          </div>
          <span className="accuracy-badge">🎯 85% TARGET</span>
        </div>

        <button
          className={`auto-toggle-btn ${isAutoTrading ? 'active' : ''}`}
          onClick={handleToggleAutoTrade}
        >
          <Zap size={22} fill={isAutoTrading ? '#000' : 'none'} />
          <span>{isAutoTrading ? '⚡ AUTO TRADING IS ON (CLICK TO STOP)' : '▶ START AUTO TRADING BOT'}</span>
        </button>

        <div className="bot-status-bar">
          <span className="status-indicator-dot"></span>
          <span>{botStatusText}</span>
        </div>
      </div>

      {/* 4. ACTIVE OPEN TRADES (If Any) */}
      {openPositions.length > 0 && (
        <div className="clean-card">
          <label className="card-label">ACTIVE OPEN POSITIONS ({openPositions.length})</label>
          <div className="positions-list">
            {openPositions.map((pos) => (
              <div key={pos.id} className="pos-item">
                <div className="pos-col">
                  <strong>{pos.symbol}</strong>
                  <span className={`pos-tag ${pos.side === 'BUY' ? 'buy' : 'sell'}`}>{pos.side}</span>
                </div>
                <div className="pos-col">
                  <span className="pos-lbl">Entry Price:</span>
                  <span>${pos.entryPrice}</span>
                </div>
                <div className="pos-col">
                  <span className="pos-lbl">Floating PnL:</span>
                  <strong className={(pos.floatingPnl || 0) >= 0 ? 'text-green' : 'text-red'}>
                    {(pos.floatingPnl || 0) >= 0 ? '+' : ''}${pos.floatingPnl || 0}
                  </strong>
                </div>
                <button
                  className="clean-close-sm"
                  onClick={() => handleCloseManualTrade()}
                >
                  Close
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={() => fetchStatus()}
      />

      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
