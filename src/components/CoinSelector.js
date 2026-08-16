'use client';

import React, { useState } from 'react';
import { Coins, Search } from 'lucide-react';

const POPULAR_COINS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT', 'XRPUSDT', 'ADAUSDT', 'AVAXUSDT', 'NEARUSDT'];

export default function CoinSelector({ selectedSymbol, onSelectSymbol, tickersMap, currentAnalysis }) {
  const [searchInput, setSearchInput] = useState('');

  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      let sym = searchInput.trim().toUpperCase();
      if (sym) {
        if (!sym.endsWith('USDT')) sym += 'USDT';
        onSelectSymbol(sym);
        setSearchInput('');
      }
    }
  };

  const currentTicker = tickersMap.get(selectedSymbol) || { price: 0, changePercent: 0 };
  const isPos = (currentTicker.changePercent || 0) >= 0;

  return (
    <div className="panel-card">
      <div className="panel-header">
        <div className="panel-title">
          <Coins size={18} color="var(--binance-gold)" />
          <h3>SELECT TRADING COIN</h3>
        </div>
        <div className="coin-search-wrap">
          <input
            type="text"
            placeholder="Search pair (e.g. SOL)..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearch}
          />
        </div>
      </div>

      {/* Quick Select Chips */}
      <div className="coin-chips-grid">
        {POPULAR_COINS.map((sym) => {
          const t = tickersMap.get(sym);
          const priceStr = t ? `$${t.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : '$--';
          const isSelected = sym === selectedSymbol;

          return (
            <button
              key={sym}
              className={`coin-chip ${isSelected ? 'active' : ''}`}
              onClick={() => onSelectSymbol(sym)}
            >
              <span className="coin-name">{sym.replace('USDT', '')}</span>
              <span className="coin-price">{priceStr}</span>
            </button>
          );
        })}
      </div>

      {/* Active Coin Stats */}
      <div className="active-coin-stats">
        <div className="stat-box">
          <span className="stat-label">SELECTED BINANCE PAIR</span>
          <span className="stat-val coin-highlight">{selectedSymbol.replace('USDT', '/USDT')}</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">BINANCE LIVE PRICE</span>
          <span className="stat-val price-highlight">
            ${currentTicker.price ? currentTicker.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '0.00'}
          </span>
        </div>
        <div className="stat-box">
          <span className="stat-label">24H CHANGE</span>
          <span className={`stat-val ${isPos ? 'text-green' : 'text-red'}`}>
            {isPos ? '+' : ''}
            {(currentTicker.changePercent || 0).toFixed(2)}%
          </span>
        </div>
        <div className="stat-box">
          <span className="stat-label">CONFLUENCE SIGNAL</span>
          <span
            className="stat-val signal-tag"
            style={{
              color:
                currentAnalysis?.signal === 'BUY'
                  ? 'var(--primary-green)'
                  : currentAnalysis?.signal === 'SELL'
                  ? 'var(--danger-red)'
                  : 'var(--text-muted)'
            }}
          >
            {currentAnalysis?.signal ? `${currentAnalysis.signal} (${currentAnalysis.confidence}%)` : 'ANALYZING...'}
          </span>
        </div>
      </div>
    </div>
  );
}
