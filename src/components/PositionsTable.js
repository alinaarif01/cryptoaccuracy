'use client';

import React from 'react';
import { Activity } from 'lucide-react';

export default function PositionsTable({ positions, onClosePosition }) {
  const totalFloating = positions.reduce((acc, p) => acc + (p.floatingPnl || 0), 0);
  const isPos = totalFloating >= 0;

  return (
    <div className="panel-card positions-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Activity size={18} color="var(--binance-gold)" />
          <h3>ACTIVE OPEN POSITIONS</h3>
          <span className="counter-badge">{positions.length}</span>
        </div>
        <div className="floating-pnl-summary">
          <span>Total Floating PnL:</span>
          <strong className={`floating-pnl-val ${isPos ? 'text-green' : 'text-red'}`}>
            {isPos ? '+' : ''}${totalFloating.toFixed(2)}
          </strong>
        </div>
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Coin Pair</th>
              <th>Side / Source</th>
              <th>Entry Price</th>
              <th>Current Price</th>
              <th>Order Size</th>
              <th>Floating PnL ($ / %)</th>
              <th>Target TP / SL</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={8}>
                  No active open positions on Binance. Start a manual trade or turn ON Auto Trading.
                </td>
              </tr>
            ) : (
              positions.map((pos) => {
                const isBuy = pos.side === 'BUY';
                const flPnl = pos.floatingPnl || 0;
                const flPercent = pos.floatingPnlPercent || 0;
                const isProfit = flPnl >= 0;

                return (
                  <tr key={pos.id}>
                    <td>
                      <strong>{pos.symbol.replace('USDT', '/USDT')}</strong>
                    </td>
                    <td>
                      <span className={`side-tag ${isBuy ? 'buy' : 'sell'}`}>{pos.side}</span>
                      <span className="source-tag">
                        {pos.source === 'auto' ? '⚡ AUTO' : '🕹️ MAN'}
                      </span>
                    </td>
                    <td>
                      ${pos.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </td>
                    <td>
                      ${(pos.currentPrice || pos.entryPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </td>
                    <td>${pos.amountUsdt ? pos.amountUsdt.toFixed(2) : '--'}</td>
                    <td className={isProfit ? 'text-green' : 'text-red'}>
                      <strong>
                        {isProfit ? '+' : ''}${flPnl.toFixed(2)}
                      </strong>{' '}
                      ({isProfit ? '+' : ''}{flPercent.toFixed(2)}%)
                    </td>
                    <td>
                      TP: +{pos.tpPercent || 1.8}% | SL: -{pos.slPercent || 1.0}%
                    </td>
                    <td>
                      <button
                        className="btn-close-pos"
                        onClick={() => onClosePosition(pos.id)}
                      >
                        Close
                      </button>
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
