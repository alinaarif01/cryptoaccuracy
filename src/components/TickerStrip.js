'use client';

import React from 'react';

export default function TickerStrip({ tickers, selectedSymbol, onSelectSymbol }) {
  if (!tickers || tickers.length === 0) {
    return (
      <div className="ticker-strip">
        <div className="ticker-item">Loading real-time Binance 24hr tickers...</div>
      </div>
    );
  }

  return (
    <div className="ticker-strip">
      {tickers.map((t) => {
        const isPos = (t.changePercent || 0) >= 0;
        const isActive = t.symbol === selectedSymbol;

        return (
          <div
            key={t.symbol}
            className={`ticker-item ${isActive ? 'active' : ''}`}
            onClick={() => onSelectSymbol(t.symbol)}
          >
            <span className="sym">{t.symbol.replace('USDT', '')}</span>
            <span className="val">
              ${(t.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
            </span>
            <span className={`chg ${isPos ? 'pos' : 'neg'}`}>
              {isPos ? '+' : ''}
              {(t.changePercent || 0).toFixed(2)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
