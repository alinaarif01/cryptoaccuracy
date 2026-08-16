'use client';

import React, { useEffect, useRef } from 'react';
import { Terminal, Trash2 } from 'lucide-react';

export default function BotTerminal({ logs, onClearLogs }) {
  const terminalRef = useRef(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="panel-card terminal-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Terminal size={18} color="var(--binance-gold)" />
          <h3>REAL-TIME BINANCE BOT ACTIVITY & SIGNALS LOG</h3>
        </div>
        <button className="clear-log-btn" onClick={onClearLogs}>
          Clear Log
        </button>
      </div>

      <div className="terminal-body" ref={terminalRef}>
        {logs.length === 0 ? (
          <div className="log-line info">
            <span className="log-time">[SYSTEM]</span> Connected to Binance real-time market data stream. Waiting for bot activity...
          </div>
        ) : (
          logs.map((l, index) => (
            <div key={index} className={`log-line ${l.type || 'info'}`}>
              <span className="log-time">[{l.time || 'LIVE'}]</span> {l.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
