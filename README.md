# Crypto Accuracy - Binance Manual & Auto Trading System

A cryptocurrency trading application featuring **Manual Trading** (Coin Selector, Start Trade, Close Trade) and an **Autonomous Auto-Trading Engine** (multi-indicator RSI + EMA confluence targeting 85%+ win-rates) connected to Binance API and live market feeds.

---

## 🌟 Key Features

1. **Coin Selection & Live Market Monitor**:
   - Quick one-click coin switch (BTC, ETH, SOL, BNB, DOGE, XRP, etc.) or search any Binance USDT pair.
   - Real-time candlestick charts with live EMA 9 and EMA 21 indicator overlays.
   - Dynamic 24h ticker feed and live Binance price updates via WebSockets.

2. **🕹️ Manual Trading Control**:
   - **Coin Selector**: Select target cryptocurrency pair.
   - **Trade Direction**: Toggle between BUY (Long) or SELL (Short).
   - **Order Size**: Input USDT order amount or use preset quick percentage buttons (25%, 50%, 75%, 100%).
   - **🚀 START TRADE Button**: Instantly places market order on Binance.
   - **🛑 CLOSE TRADE Button**: Exits active position with one click and records exact realized PnL.

3. **⚡ Autonomous Auto-Trading Engine**:
   - **Master Switch (ON / OFF)**: Toggle fully automated algorithmic trading.
   - **🎯 85% Target Win-Rate Confluence**:
     - Evaluates 5-minute candle history across multiple coins.
     - Exponential Moving Average (EMA 9 / EMA 21 Golden & Death cross).
     - Relative Strength Index (RSI momentum and oversold/overbought pullbacks).
     - MACD histogram momentum and volume breakout confirmation.
   - Automatically opens high-probability trades and sets Take-Profit (+1.8%) and Stop-Loss (-1.0%) targets.
   - Continuously monitors active trades and auto-closes them when profit targets are secured.

4. **Multi-Mode Support**:
   - **🛡️ Paper Simulation (Default)**: Practice with live real-time Binance prices and a virtual $10,000 USDT balance without risk.
   - **🧪 Binance Testnet**: Test orders using Binance Spot Testnet API credentials.
   - **🔥 Binance Live**: Real order execution on your live Binance account.

---

## 🚀 How to Run

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start the Server**:
   ```bash
   npm start
   ```

3. **Open in Browser**:
   Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 📁 Project Structure

```
crypto accuracy/
├── server/
│   ├── config.js          # Settings & state persistence
│   ├── binanceClient.js   # Binance API & Paper trade executor
│   ├── strategyEngine.js  # RSI, EMA, MACD confluence calculation
│   ├── botWorker.js       # Auto-trading background engine & TP/SL manager
│   └── server.js          # Express backend & WebSocket server
├── public/
│   ├── index.html         # Main dashboard layout
│   ├── css/
│   │   └── style.css      # Cyberpunk dark trading design system
│   └── js/
│       ├── api.js         # REST & WebSocket client
│       ├── chart.js       # Candlestick chart & indicator renderer
│       └── app.js         # State controller & UI event handlers
├── data/                  # Persistent runtime JSON storage
└── package.json           # Node.js dependencies
```
