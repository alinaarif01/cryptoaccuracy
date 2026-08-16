'use client';

import React from 'react';
import { History } from 'lucide-react';

export default function TradeHistoryTable({ history, onRefresh }) {
  return (
    <div className="panel-card history-panel">
      <div className="panel-header">
        <div className="panel-title">
          <History size={18} color="var(--binance-gold)" />
          <h3>COMPLETED TRADE HISTORY</h3>
        </div>
        <button className="refresh-history-btn" onClick={onRefresh}>
          Refresh History
        </button>
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Trade ID</th>
              <th>Coin</th>
              <th>Side</th>
              <th>Source</th>
              <th>Entry Price</th>
              <th>Exit Price</th>
              <th>PnL ($)</th>
              <th>PnL (%)</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={9}>No closed trade records yet.</td>
              </tr>
            ) : (
              history.map((t) => {
                const isWin = (t.pnl || 0) >= 0;
                return (
                  <tr key={t.id || Math.random()}>
                    <td style={{ fontSize: '0.7rem', color: '#8fa0c0' }}>
                      {t.id ? t.id.slice(-8) : '--'}
                    </td>
                    <td>
                      <strong>{t.symbol.replace('USDT', '')}</strong>
                    </td>
                    <td>
                      <span className={`side-tag ${t.side === 'BUY' ? 'buy' : 'sell'}`}>{t.side}</span>
                    </td>
                    <td>
                      <span className="source-tag">
                        {t.source === 'auto' ? '⚡ AUTO' : '🕹️ MAN'}
                      </span>
                    </td>
                    <td>
                      ${(t.entryPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </td>
                    <td>
                      ${(t.exitPrice || t.entryPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </td>
                    <td className={isWin ? 'text-green' : 'text-red'}>
                      <strong>
                        {isWin ? '+' : ''}${(t.pnl || 0).toFixed(2)}
                      </strong>
                    </td>
                    <td className={isWin ? 'text-green' : 'text-red'}>
                      {isWin ? '+' : ''}{(t.pnlPercent || 0).toFixed(2)}%
                    </td>
                    <td>
                      <span className={`side-tag ${isWin ? 'buy' : 'sell'}`}>
                        {isWin ? 'WIN 🎯' : 'LOSS 🛑'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
