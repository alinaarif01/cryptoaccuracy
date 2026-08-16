'use client';

import React, { useEffect, useRef, useState } from 'react';
import { RotateCw, BarChart2 } from 'lucide-react';

export default function TradingChart({ symbol, livePrice }) {
  const containerRef = useRef(null);
  const [chartMode, setChartMode] = useState('tradingview'); // 'tradingview' | 'lightweight'
  const [timeframe, setTimeframe] = useState('5'); // in minutes for TV: '1', '3', '5', '15', '60', '240', 'D'

  const formattedSymbol = `BINANCE:${symbol.replace('/', '').toUpperCase()}`;

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = '';

    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container';
    widgetContainer.style.height = '100%';
    widgetContainer.style.width = '100%';

    const widgetHolder = document.createElement('div');
    widgetHolder.id = 'tradingview_chart_holder';
    widgetHolder.style.height = '100%';
    widgetHolder.style.width = '100%';
    widgetContainer.appendChild(widgetHolder);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.type = 'text/javascript';
    script.async = true;
    script.onload = () => {
      if (typeof window.TradingView !== 'undefined' && document.getElementById('tradingview_chart_holder')) {
        new window.TradingView.widget({
          autosize: true,
          symbol: formattedSymbol,
          interval: timeframe,
          timezone: 'Etc/UTC',
          theme: 'dark',
          style: '1',
          locale: 'en',
          toolbar_bg: '#090e18',
          enable_publishing: false,
          allow_symbol_change: true,
          container_id: 'tradingview_chart_holder',
          hide_side_toolbar: false,
          studies: ['MASimple@tv-basicstudies', 'RSI@tv-basicstudies', 'MACD@tv-basicstudies'],
          overrides: {
            'paneProperties.background': '#090e18',
            'paneProperties.vertGridProperties.color': 'rgba(255, 255, 255, 0.04)',
            'paneProperties.horzGridProperties.color': 'rgba(255, 255, 255, 0.04)',
            'mainSeriesProperties.candleStyle.upColor': '#00f59b',
            'mainSeriesProperties.candleStyle.downColor': '#ff3b69',
            'mainSeriesProperties.candleStyle.wickUpColor': '#00f59b',
            'mainSeriesProperties.candleStyle.wickDownColor': '#ff3b69',
            'mainSeriesProperties.candleStyle.borderUpColor': '#00f59b',
            'mainSeriesProperties.candleStyle.borderDownColor': '#ff3b69'
          }
        });
      }
    };

    widgetContainer.appendChild(script);
    containerRef.current.appendChild(widgetContainer);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol, timeframe]);

  return (
    <div className="panel-card chart-panel">
      <div className="chart-header">
        <div className="chart-title-wrap">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart2 size={20} color="var(--binance-gold)" />
            <h2>{symbol.replace('USDT', '/USDT')} REAL-TIME BINANCE CHART</h2>
          </div>
          <span className="chart-price-live">
            ${livePrice ? livePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '0.00'}
          </span>
        </div>

        <div className="chart-controls">
          <div className="timeframe-selector">
            {[
              { label: '1m', val: '1' },
              { label: '5m', val: '5' },
              { label: '15m', val: '15' },
              { label: '1h', val: '60' },
              { label: '4h', val: '240' },
              { label: '1D', val: 'D' }
            ].map((tf) => (
              <button
                key={tf.val}
                className={`tf-btn ${timeframe === tf.val ? 'active' : ''}`}
                onClick={() => setTimeframe(tf.val)}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className="chart-wrapper"
        ref={containerRef}
        style={{ height: '420px', width: '100%', minHeight: '400px' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)'
          }}
        >
          Loading Binance Live Candlestick Stream...
        </div>
      </div>
    </div>
  );
}
