/**
 * API & WebSocket Communication Layer
 */

const API_BASE = window.location.origin;

const API = {
  // REST Calls
  async getStatus() {
    const res = await fetch(`${API_BASE}/api/status`);
    return await res.json();
  },

  async getTickers() {
    const res = await fetch(`${API_BASE}/api/tickers`);
    return await res.json();
  },

  async getTicker(symbol) {
    const res = await fetch(`${API_BASE}/api/ticker/${symbol}`);
    return await res.json();
  },

  async getKlines(symbol, interval = '5m', limit = 60) {
    const res = await fetch(`${API_BASE}/api/klines/${symbol}?interval=${interval}&limit=${limit}`);
    return await res.json();
  },

  async getAnalysis(symbol, interval = '5m') {
    const res = await fetch(`${API_BASE}/api/analysis/${symbol}?interval=${interval}`);
    return await res.json();
  },

  async startManualTrade(payload) {
    const res = await fetch(`${API_BASE}/api/trade/manual/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  },

  async closeManualTrade(payload = {}) {
    const res = await fetch(`${API_BASE}/api/trade/manual/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  },

  async toggleAutoTrade(enable) {
    const res = await fetch(`${API_BASE}/api/auto-trade/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enable })
    });
    return await res.json();
  },

  async updateBotConfig(config) {
    const res = await fetch(`${API_BASE}/api/auto-trade/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    return await res.json();
  },

  async getPositions() {
    const res = await fetch(`${API_BASE}/api/positions`);
    return await res.json();
  },

  async getHistory() {
    const res = await fetch(`${API_BASE}/api/history`);
    return await res.json();
  },

  async getLogs() {
    const res = await fetch(`${API_BASE}/api/logs`);
    return await res.json();
  },

  async getSettings() {
    const res = await fetch(`${API_BASE}/api/settings`);
    return await res.json();
  },

  async saveSettings(settings) {
    const res = await fetch(`${API_BASE}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    return await res.json();
  }
};

// WebSocket Real-time Manager
class SocketManager {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.connect();
  }

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        const badge = document.getElementById('wsStatus');
        if (badge) badge.innerText = 'LIVE BINANCE WS';
        this.emit('connected', true);
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.emit(message.type, message.data);
        } catch (e) {
          console.error('WS Parse Error:', e);
        }
      };

      this.ws.onclose = () => {
        const badge = document.getElementById('wsStatus');
        if (badge) badge.innerText = 'RECONNECTING...';
        setTimeout(() => this.connect(), 3000);
      };

      this.ws.onerror = () => {
        if (this.ws) this.ws.close();
      };
    } catch (e) {
      setTimeout(() => this.connect(), 4000);
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => cb(data));
    }
  }
}

const socket = new SocketManager();
