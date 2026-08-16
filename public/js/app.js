/**
 * Main Application Logic & UI State Controller
 */

let appState = {
  selectedSymbol: 'BTCUSDT',
  manualSide: 'BUY',
  manualAmount: 50,
  isAutoTrading: false,
  tradingMode: 'paper',
  walletBalance: 10000.00,
  openPositions: [],
  tickers: new Map(),
  stats: {
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRate: 0,
    totalProfit: 0,
    targetWinRate: 85.0
  }
};

// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  initChart();
  fetchInitialData();
  setupWebSocketListeners();
});

// Setup DOM Event Listeners
function initEventListeners() {
  // Coin Chips Selection
  document.querySelectorAll('.coin-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const sym = chip.dataset.symbol;
      selectCoin(sym);
    });
  });

  // Coin Search Input
  const searchInput = document.getElementById('coinSearchInput');
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        let val = searchInput.value.trim().toUpperCase();
        if (val) {
          if (!val.endsWith('USDT')) val += 'USDT';
          selectCoin(val);
          searchInput.value = '';
        }
      }
    });
  }

  // Amount input change
  const amountInput = document.getElementById('manualAmountInput');
  if (amountInput) {
    amountInput.addEventListener('input', (e) => {
      appState.manualAmount = parseFloat(e.target.value) || 0;
    });
  }
}

// Fetch Initial Data
async function fetchInitialData() {
  try {
    const statusRes = await API.getStatus();
    if (statusRes.success) {
      appState.tradingMode = statusRes.mode;
      appState.walletBalance = statusRes.balance.usdt;
      appState.isAutoTrading = statusRes.isAutoTrading;
      if (statusRes.stats) appState.stats = statusRes.stats;
      updateUIHeader();
      updatePerformanceStats();
    }

    // Load initial positions
    const posRes = await API.getPositions();
    if (posRes.success) {
      appState.openPositions = posRes.positions;
      renderPositionsTable();
    }

    // Load initial trade history
    fetchTradeHistory();

    // Load initial logs
    const logsRes = await API.getLogs();
    if (logsRes.success && logsRes.logs) {
      logsRes.logs.reverse().forEach(log => appendTerminalLog(log));
    }

    // Load selected coin stats & chart
    selectCoin(appState.selectedSymbol);
  } catch (err) {
    console.error('Error in fetchInitialData:', err);
  }
}

// WebSocket Event Subscriptions
function setupWebSocketListeners() {
  socket.on('TICKER_UPDATE', (data) => {
    if (data.tickers) {
      updateTickerStrip(data.tickers);
      data.tickers.forEach(t => appState.tickers.set(t.symbol, t));
      updateActiveCoinDisplay();
    }

    if (data.balance) {
      appState.walletBalance = data.balance.usdt;
      updateUIHeader();
    }

    if (data.positions) {
      appState.openPositions = data.positions;
      renderPositionsTable();
    }

    if (data.isAutoTrading !== undefined) {
      setAutoTradingUI(data.isAutoTrading);
    }
  });

  socket.on('POSITIONS_UPDATED', (positions) => {
    appState.openPositions = positions;
    renderPositionsTable();
    fetchStatusStats();
  });

  socket.on('AUTOTRADE_TOGGLED', (data) => {
    setAutoTradingUI(data.isRunning);
    showToast(`Auto-Trading Bot is now ${data.isRunning ? 'ACTIVE ⚡' : 'STOPPED 🛑'}`, data.isRunning ? 'success' : 'info');
  });

  socket.on('BOT_LOG', (logEntry) => {
    appendTerminalLog(logEntry);
    if (logEntry.type === 'trade' || logEntry.type === 'success') {
      fetchStatusStats();
      fetchTradeHistory();
    }
  });
}

// Select a Coin
async function selectCoin(symbol) {
  appState.selectedSymbol = symbol;

  // Update active chip styling
  document.querySelectorAll('.coin-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.symbol === symbol);
  });

  const displayElem = document.getElementById('activeSymbolDisplay');
  if (displayElem) {
    displayElem.innerText = symbol.replace('USDT', '/USDT');
  }

  // Load candle chart
  loadCandlestickChart(symbol);

  // Fetch signal analysis
  fetchCoinAnalysis(symbol);
}

// Update Active Coin Stats
async function updateActiveCoinDisplay() {
  const current = appState.tickers.get(appState.selectedSymbol);
  if (!current) return;

  const priceElem = document.getElementById('activePriceDisplay');
  const changeElem = document.getElementById('activeChangeDisplay');

  if (priceElem) {
    priceElem.innerText = `$${current.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  }

  if (changeElem) {
    const isPos = current.changePercent >= 0;
    changeElem.innerText = `${isPos ? '+' : ''}${current.changePercent.toFixed(2)}%`;
    changeElem.className = `stat-val ${isPos ? 'text-green' : 'text-red'}`;
  }
}

// Fetch Analysis Confluence
async function fetchCoinAnalysis(symbol) {
  const sigElem = document.getElementById('activeSignalDisplay');
  if (sigElem) sigElem.innerText = 'ANALYZING...';

  try {
    const res = await API.getAnalysis(symbol);
    if (res.success && res.analysis && sigElem) {
      const { signal, confidence } = res.analysis;
      if (signal === 'BUY') {
        sigElem.innerText = `BUY (${confidence}%)`;
        sigElem.style.color = '#00f59b';
      } else if (signal === 'SELL') {
        sigElem.innerText = `SELL (${confidence}%)`;
        sigElem.style.color = '#ff3b69';
      } else {
        sigElem.innerText = `NEUTRAL (${confidence}%)`;
        sigElem.style.color = '#8fa0c0';
      }
    }
  } catch (e) {
    if (sigElem) sigElem.innerText = 'READY';
  }
}

// Update Top Ticker Bar
function updateTickerStrip(tickers) {
  const strip = document.getElementById('tickerStrip');
  if (!strip) return;

  strip.innerHTML = tickers.map(t => {
    const isPos = t.changePercent >= 0;
    return `
      <div class="ticker-item" onclick="selectCoin('${t.symbol}')">
        <span class="sym">${t.symbol.replace('USDT', '')}</span>
        <span class="val">$${t.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
        <span class="chg ${isPos ? 'pos' : 'neg'}">${isPos ? '+' : ''}${t.changePercent.toFixed(2)}%</span>
      </div>
    `;
  }).join('');

  // Update prices inside coin chips
  tickers.forEach(t => {
    const chipPrice = document.getElementById(`chip-${t.symbol}`);
    if (chipPrice) {
      chipPrice.innerText = `$${t.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
    }
  });
}

// Update UI Header Elements
function updateUIHeader() {
  const modeTag = document.getElementById('modeTag');
  if (modeTag) {
    if (appState.tradingMode === 'paper') modeTag.innerText = 'PAPER SIM';
    else if (appState.tradingMode === 'testnet') modeTag.innerText = 'BINANCE TESTNET';
    else modeTag.innerText = 'BINANCE LIVE 🔥';
  }

  const balElem = document.getElementById('walletBalance');
  if (balElem) {
    balElem.innerHTML = `$${appState.walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span class="currency">USDT</span>`;
  }

  const availElem = document.getElementById('availUsdtText');
  if (availElem) {
    availElem.innerText = `$${appState.walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
  }
}

// ==================== MANUAL TRADING CONTROLS ==================== //

function setManualSide(side) {
  appState.manualSide = side;
  document.getElementById('manualSideBuy').classList.toggle('active', side === 'BUY');
  document.getElementById('manualSideSell').classList.toggle('active', side === 'SELL');
}

function setManualAmount(amount) {
  appState.manualAmount = amount;
  const input = document.getElementById('manualAmountInput');
  if (input) input.value = amount;

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.toggle('active', btn.innerText === `$${amount}`);
  });
}

function setManualAmountPercent(percent) {
  const calculated = Math.floor((appState.walletBalance * percent) / 100);
  setManualAmount(calculated > 10 ? calculated : 10);
}

// START TRADE Button Click
async function handleStartManualTrade() {
  const startBtn = document.getElementById('startTradeBtn');
  const amount = parseFloat(document.getElementById('manualAmountInput').value) || 50;
  const tpPercent = parseFloat(document.getElementById('manualTpInput').value) || 2.0;
  const slPercent = parseFloat(document.getElementById('manualSlInput').value) || 1.2;

  if (amount > appState.walletBalance) {
    showToast(`Insufficient USDT balance ($${appState.walletBalance.toFixed(2)} available)`, 'error');
    return;
  }

  startBtn.disabled = true;
  startBtn.style.opacity = '0.7';

  try {
    const payload = {
      symbol: appState.selectedSymbol,
      side: appState.manualSide,
      amountUsdt: amount,
      takeProfitPercent: tpPercent,
      stopLossPercent: slPercent
    };

    const res = await API.startManualTrade(payload);
    if (res.success) {
      showToast(`🚀 Trade Executed! ${payload.side} ${payload.symbol} ($${amount} USDT)`, 'success');
      appState.openPositions = res.positions;
      renderPositionsTable();
      fetchStatusStats();
    } else {
      showToast(`Trade Failed: ${res.error}`, 'error');
    }
  } catch (err) {
    showToast(`Network Error: ${err.message}`, 'error');
  } finally {
    startBtn.disabled = false;
    startBtn.style.opacity = '1';
  }
}

// CLOSE TRADE Button Click
async function handleCloseManualTrade() {
  const closeBtn = document.getElementById('closeTradeBtn');

  // Check if position exists for current symbol or any open trade
  const match = appState.openPositions.find(p => p.symbol === appState.selectedSymbol) || appState.openPositions[0];

  if (!match) {
    showToast('No active trade open for this coin to close.', 'info');
    return;
  }

  closeBtn.disabled = true;
  closeBtn.style.opacity = '0.7';

  try {
    const res = await API.closeManualTrade({ tradeId: match.id });
    if (res.success) {
      const isWin = res.closedTrade.pnl >= 0;
      showToast(`🛑 Position Closed: ${match.symbol} | PnL: ${isWin ? '+' : ''}$${res.closedTrade.pnl} (${isWin ? '+' : ''}${res.closedTrade.pnlPercent}%)`, isWin ? 'success' : 'info');
      appState.openPositions = res.positions;
      renderPositionsTable();
      fetchStatusStats();
      fetchTradeHistory();
    } else {
      showToast(`Failed to close trade: ${res.error}`, 'error');
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    closeBtn.disabled = false;
    closeBtn.style.opacity = '1';
  }
}

// Close specific position by ID
async function closeSpecificPosition(tradeId) {
  try {
    const res = await API.closeManualTrade({ tradeId });
    if (res.success) {
      showToast(`Position ${tradeId} closed successfully`, 'success');
      appState.openPositions = res.positions;
      renderPositionsTable();
      fetchStatusStats();
      fetchTradeHistory();
    } else {
      showToast(`Error: ${res.error}`, 'error');
    }
  } catch (e) {
    showToast(`Close failed: ${e.message}`, 'error');
  }
}

// ==================== AUTO TRADING BOT CONTROLS ==================== //

async function handleToggleAutoTrade(enable) {
  try {
    const res = await API.toggleAutoTrade(enable);
    if (res.success) {
      setAutoTradingUI(res.isAutoTrading);
    }
  } catch (e) {
    showToast(`Failed to toggle bot: ${e.message}`, 'error');
    const toggle = document.getElementById('autoTradeToggle');
    if (toggle) toggle.checked = !enable;
  }
}

function setAutoTradingUI(isRunning) {
  appState.isAutoTrading = isRunning;
  const toggle = document.getElementById('autoTradeToggle');
  if (toggle) toggle.checked = isRunning;

  const desc = document.getElementById('botStatusDesc');
  if (desc) {
    desc.innerText = isRunning
      ? '⚡ BOT ACTIVE: Scanning RSI/EMA confluence & executing trades automatically.'
      : 'Bot is currently IDLE. Turn ON for automatic trading.';
    desc.style.color = isRunning ? '#00f59b' : '#8fa0c0';
  }
}

async function saveBotSettings() {
  const tradeAmountUsdt = parseFloat(document.getElementById('botAmountInput').value) || 50;
  const takeProfitPercent = parseFloat(document.getElementById('botTpInput').value) || 1.8;
  const stopLossPercent = parseFloat(document.getElementById('botSlInput').value) || 1.0;
  const minConfidence = parseInt(document.getElementById('botConfidenceInput').value) || 75;

  try {
    const res = await API.updateBotConfig({
      tradeAmountUsdt,
      takeProfitPercent,
      stopLossPercent,
      minConfidence
    });

    if (res.success) {
      showToast('Bot strategy parameters saved!', 'success');
    }
  } catch (e) {
    showToast(`Save failed: ${e.message}`, 'error');
  }
}

// ==================== TABLES & DISPLAY RENDERING ==================== //

function renderPositionsTable() {
  const tbody = document.getElementById('positionsTableBody');
  const countBadge = document.getElementById('openPositionsCount');
  const totalPnlElem = document.getElementById('totalFloatingPnl');

  if (countBadge) countBadge.innerText = appState.openPositions.length;

  if (!tbody) return;

  if (appState.openPositions.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="8">No active open positions. Start a trade manually or turn on Auto Trading.</td>
      </tr>
    `;
    if (totalPnlElem) {
      totalPnlElem.innerText = '$0.00';
      totalPnlElem.className = 'floating-pnl-val';
    }
    return;
  }

  let totalFloating = 0;

  tbody.innerHTML = appState.openPositions.map(pos => {
    const isBuy = pos.side === 'BUY';
    const flPnl = pos.floatingPnl || 0;
    const flPercent = pos.floatingPnlPercent || 0;
    totalFloating += flPnl;

    const isProfit = flPnl >= 0;

    return `
      <tr>
        <td><strong>${pos.symbol.replace('USDT', '/USDT')}</strong></td>
        <td>
          <span class="side-tag ${isBuy ? 'buy' : 'sell'}">${pos.side}</span>
          <span class="source-tag">${pos.source === 'auto' ? '⚡ AUTO' : '🕹️ MAN'}</span>
        </td>
        <td>$${pos.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
        <td>$${(pos.currentPrice || pos.entryPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
        <td>$${pos.amountUsdt.toFixed(2)}</td>
        <td class="${isProfit ? 'text-green' : 'text-red'}">
          <strong>${isProfit ? '+' : ''}$${flPnl.toFixed(2)}</strong> (${isProfit ? '+' : ''}${flPercent.toFixed(2)}%)
        </td>
        <td>TP: +${pos.tpPercent || 1.8}% | SL: -${pos.slPercent || 1.0}%</td>
        <td>
          <button class="btn-close-pos" onclick="closeSpecificPosition('${pos.id}')">Close</button>
        </td>
      </tr>
    `;
  }).join('');

  if (totalPnlElem) {
    const isPos = totalFloating >= 0;
    totalPnlElem.innerText = `${isPos ? '+' : ''}$${totalFloating.toFixed(2)}`;
    totalPnlElem.className = `floating-pnl-val ${isPos ? 'text-green' : 'text-red'}`;
  }
}

async function fetchTradeHistory() {
  try {
    const res = await API.getHistory();
    if (res.success && res.history) {
      renderHistoryTable(res.history);
    }
  } catch (e) {
    console.error('Error fetching trade history:', e);
  }
}

function renderHistoryTable(history) {
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;

  if (history.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="9">No closed trade records yet.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = history.slice(0, 15).map(t => {
    const isWin = (t.pnl || 0) >= 0;
    return `
      <tr>
        <td style="font-size:0.7rem;color:#8fa0c0;">${t.id ? t.id.slice(-8) : '--'}</td>
        <td><strong>${t.symbol.replace('USDT', '')}</strong></td>
        <td><span class="side-tag ${t.side === 'BUY' ? 'buy' : 'sell'}">${t.side}</span></td>
        <td><span class="source-tag">${t.source === 'auto' ? '⚡ AUTO' : '🕹️ MAN'}</span></td>
        <td>$${t.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
        <td>$${(t.exitPrice || t.entryPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
        <td class="${isWin ? 'text-green' : 'text-red'}"><strong>${isWin ? '+' : ''}$${t.pnl.toFixed(2)}</strong></td>
        <td class="${isWin ? 'text-green' : 'text-red'}">${isWin ? '+' : ''}${t.pnlPercent.toFixed(2)}%</td>
        <td>
          <span class="side-tag ${isWin ? 'buy' : 'sell'}">${isWin ? 'WIN 🎯' : 'LOSS 🛑'}</span>
        </td>
      </tr>
    `;
  }).join('');
}

async function fetchStatusStats() {
  try {
    const res = await API.getStatus();
    if (res.success && res.stats) {
      appState.stats = res.stats;
      updatePerformanceStats();
    }
  } catch (e) {}
}

function updatePerformanceStats() {
  const s = appState.stats;
  const progressBar = document.getElementById('winRateProgressBar');
  const winRateText = document.getElementById('currentWinRateText');
  const botWinRate = document.getElementById('botWinRate');
  const botProfit = document.getElementById('botProfit');
  const botTradeCount = document.getElementById('botTradeCount');
  const accTargetStatus = document.getElementById('accTargetStatus');

  const totalTrades = document.getElementById('statTotalTrades');
  const wins = document.getElementById('statWins');
  const losses = document.getElementById('statLosses');
  const netProfit = document.getElementById('statNetProfit');

  if (totalTrades) totalTrades.innerText = s.totalTrades;
  if (wins) wins.innerText = s.winningTrades;
  if (losses) losses.innerText = s.losingTrades;
  if (netProfit) {
    const isPos = s.totalProfit >= 0;
    netProfit.innerText = `${isPos ? '+' : ''}$${s.totalProfit.toFixed(2)}`;
    netProfit.className = `mini-val ${isPos ? 'text-green' : 'text-red'}`;
  }

  const effectiveWinRate = s.recentTradesCount >= 3 ? s.recentWinRate : s.winRate;

  if (progressBar) progressBar.style.width = `${Math.min(100, effectiveWinRate)}%`;
  if (winRateText) winRateText.innerText = `${effectiveWinRate}% Recent Batch Accuracy (${s.recentTradesCount || s.totalTrades} Trades)`;
  if (botWinRate) botWinRate.innerText = `${effectiveWinRate}%`;

  if (botProfit) {
    const isPos = s.totalProfit >= 0;
    botProfit.innerText = `${isPos ? '+' : ''}$${s.totalProfit.toFixed(2)}`;
    botProfit.className = `m-val ${isPos ? 'text-green' : 'text-red'}`;
  }
  if (botTradeCount) botTradeCount.innerText = `${s.totalTrades} Total Trades`;

  if (accTargetStatus) {
    if (effectiveWinRate >= 85.0 && s.totalTrades >= 3) {
      accTargetStatus.innerText = 'TARGET ACHIEVED (≥85%) 🔥';
      accTargetStatus.style.borderColor = '#00f59b';
      accTargetStatus.style.color = '#00f59b';
    } else {
      accTargetStatus.innerText = 'MONITORING CONFLUENCE';
      accTargetStatus.style.borderColor = '#00d8ff';
      accTargetStatus.style.color = '#00d8ff';
    }
  }
}

// Terminal Log Streaming
function appendTerminalLog(log) {
  const terminal = document.getElementById('terminalLogs');
  if (!terminal) return;

  const timeStr = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
  const div = document.createElement('div');
  div.className = `log-line ${log.type || 'info'}`;
  div.innerHTML = `<span class="log-time">[${timeStr}]</span> ${log.message}`;

  terminal.appendChild(div);
  terminal.scrollTop = terminal.scrollHeight;
}

function clearLocalLogs() {
  const terminal = document.getElementById('terminalLogs');
  if (terminal) terminal.innerHTML = '<div class="log-line info"><span class="log-time">[CLEARED]</span> Log display cleared.</div>';
}

// ==================== SETTINGS MODAL ==================== //

function openSettingsModal() {
  document.getElementById('settingsModal').classList.add('active');
}

function closeSettingsModal() {
  document.getElementById('settingsModal').classList.remove('active');
}

async function saveSettingsModal() {
  const modeRadios = document.getElementsByName('tradingMode');
  let selectedMode = 'paper';
  for (const r of modeRadios) {
    if (r.checked) {
      selectedMode = r.value;
      break;
    }
  }

  const apiKey = document.getElementById('binanceApiKey').value.trim();
  const apiSecret = document.getElementById('binanceApiSecret').value.trim();
  const paperBalance = parseFloat(document.getElementById('paperBalanceInput').value) || 10000;

  const payload = {
    mode: selectedMode,
    paperBalance
  };

  if (apiKey) payload.apiKey = apiKey;
  if (apiSecret) payload.apiSecret = apiSecret;

  try {
    const res = await API.saveSettings(payload);
    if (res.success) {
      appState.tradingMode = res.settings.mode;
      appState.walletBalance = res.settings.paperBalance;
      updateUIHeader();
      closeSettingsModal();
      showToast(`Settings Saved! Active Mode: ${res.settings.mode.toUpperCase()}`, 'success');
    }
  } catch (e) {
    showToast(`Error saving settings: ${e.message}`, 'error');
  }
}

function resetPaperBalance() {
  const input = document.getElementById('paperBalanceInput');
  if (input) input.value = 10000;
}

// Toast Notifications Helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerText = message;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
