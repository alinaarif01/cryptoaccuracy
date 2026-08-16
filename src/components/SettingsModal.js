'use client';

import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Key, Lock, ExternalLink } from 'lucide-react';

export default function SettingsModal({ isOpen, onClose, onSaved }) {
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [useTestnet, setUseTestnet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/settings')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.settings) {
            setApiKey(data.settings.apiKey || 'UrRgxXFMD7sL0umV7u8LEU943pJ6cbPU1STAW8x0g3uJ2zaCRhRScTGZUZwJAbOX');
            setApiSecret(data.settings.apiSecret || 'L1ffOIr6IAC8wCUwWQ0gBzjVEPrDHlf8XWKtEu7npoRsJXHkMvAGBS5nnxoAgOSG');
            setUseTestnet(!!data.settings.useTestnet);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          apiSecret,
          useTestnet
        })
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: 'success', text: '✅ Binance API credentials saved to System & .env.local!' });
        setTimeout(() => {
          onSaved();
          onClose();
        }, 1200);
      } else {
        setMsg({ type: 'error', text: `❌ Error: ${data.error}` });
      }
    } catch (err) {
      setMsg({ type: 'error', text: `❌ Network Error: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay active">
      <div className="modal-card">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key size={20} color="var(--binance-gold)" />
            <h3>Binance API & Network Configuration</h3>
          </div>
          <button className="close-modal-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="modal-body">
          {msg && (
            <div
              style={{
                padding: '10px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                backgroundColor: msg.type === 'success' ? 'rgba(0,245,155,0.1)' : 'rgba(255,59,105,0.1)',
                border: `1px solid ${msg.type === 'success' ? 'var(--primary-green)' : 'var(--danger-red)'}`,
                color: msg.type === 'success' ? 'var(--primary-green)' : 'var(--danger-red)'
              }}
            >
              {msg.text}
            </div>
          )}

          {/* Network Selection */}
          <div className="form-group">
            <label>Binance Network Mode:</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <label
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: !useTestnet ? 'rgba(243, 186, 47, 0.12)' : 'var(--bg-card-secondary)',
                  border: `1px solid ${!useTestnet ? 'var(--binance-gold)' : 'var(--border-color)'}`,
                  padding: '10px',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="radio"
                  name="netMode"
                  checked={!useTestnet}
                  onChange={() => setUseTestnet(false)}
                />
                <div>
                  <strong style={{ fontSize: '0.82rem', color: '#fff' }}>🔥 Binance Live</strong>
                  <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Real Binance Account</p>
                </div>
              </label>

              <label
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: useTestnet ? 'rgba(0, 216, 255, 0.12)' : 'var(--bg-card-secondary)',
                  border: `1px solid ${useTestnet ? 'var(--accent-cyan)' : 'var(--border-color)'}`,
                  padding: '10px',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="radio"
                  name="netMode"
                  checked={useTestnet}
                  onChange={() => setUseTestnet(true)}
                />
                <div>
                  <strong style={{ fontSize: '0.82rem', color: '#fff' }}>🧪 Binance Testnet</strong>
                  <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>testnet.binance.vision</p>
                </div>
              </label>
            </div>
          </div>

          {/* API Key */}
          <div className="form-group">
            <label htmlFor="binanceApiKey">Binance API Key:</label>
            <input
              id="binanceApiKey"
              type="text"
              placeholder="Paste your Binance API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          {/* API Secret */}
          <div className="form-group">
            <label htmlFor="binanceApiSecret">Binance API Secret:</label>
            <input
              id="binanceApiSecret"
              type="password"
              placeholder="Paste your Binance API Secret"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
            />
          </div>

          <div className="help-text">
            <strong>🔒 Security Guidance:</strong>
            <ul style={{ paddingLeft: '16px', marginTop: '4px' }}>
              <li>In Binance API Management, ensure <strong>Enable Reading</strong> and <strong>Enable Spot & Margin Trading</strong> are checked.</li>
              <li>Always keep <strong>Enable Withdrawals UNCHECKED (OFF)</strong>.</li>
              <li>Credentials are saved directly to your local <code>.env.local</code> and server config.</li>
            </ul>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save & Connect to Binance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
