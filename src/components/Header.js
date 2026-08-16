'use client';

import React from 'react';
import { Sliders, Activity, ShieldCheck, Zap } from 'lucide-react';

export default function Header({ wsConnected, accountInfo, onOpenSettings }) {
  const isConfigured = accountInfo?.isConfigured;
  const usdtBalance = accountInfo?.usdt || 0;

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="logo-container">
          <div className="logo-icon">
            <Zap size={22} color="#000" fill="#000" />
          </div>
          <div className="logo-text">
            <span className="brand-title">
              CRYPTO <span className="accent-text">ACCURACY</span>
            </span>
            <span className="brand-subtitle">BINANCE LIVE TRADING ENGINE</span>
          </div>
        </div>
        <div className="live-badge">
          <span className="pulse-dot"></span>
          <span>{wsConnected ? 'BINANCE STREAM LIVE' : 'CONNECTING...'}</span>
        </div>
      </div>

      <div className="header-right">
        <div className="mode-pill" onClick={onOpenSettings}>
          <ShieldCheck size={14} />
          <span>{accountInfo?.mode === 'testnet' ? 'BINANCE TESTNET' : 'BINANCE LIVE 🔥'}</span>
        </div>

        <div className="balance-card" onClick={onOpenSettings} title="Click to view API & Account Settings">
          <span className="balance-label">BINANCE USDT BALANCE</span>
          <span className="balance-value">
            {isConfigured ? (
              <>
                ${usdtBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                <span className="currency">USDT</span>
              </>
            ) : (
              <span style={{ fontSize: '0.8rem', color: 'var(--binance-gold)' }}>🔑 Click to Connect API</span>
            )}
          </span>
        </div>

        <button className="settings-btn" onClick={onOpenSettings} title="Binance API Settings">
          <Sliders size={18} />
        </button>
      </div>
    </header>
  );
}
