/**
 * Live Candlestick & Indicator Chart using Lightweight Charts
 */

let chartInstance = null;
let candleSeries = null;
let ema9Series = null;
let ema21Series = null;
let currentChartSymbol = 'BTCUSDT';
let currentChartTimeframe = '5m';

function initChart() {
  const container = document.getElementById('tradingViewChartContainer');
  if (!container) return;

  // Clear previous if any
  container.innerHTML = '';

  if (typeof LightweightCharts === 'undefined') {
    container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#8fa0c0;">Loading Trading Chart Engine...</div>`;
    setTimeout(initChart, 500);
    return;
  }

  chartInstance = LightweightCharts.createChart(container, {
    width: container.clientWidth,
    height: container.clientHeight || 380,
    layout: {
      background: { color: '#0d121c' },
      textColor: '#8fa0c0',
      fontSize: 11,
      fontFamily: 'Outfit, sans-serif'
    },
    grid: {
      vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
      horzLines: { color: 'rgba(255, 255, 255, 0.04)' }
    },
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
      vertLine: { color: '#00d8ff', width: 1, style: 3 },
      horzLine: { color: '#00d8ff', width: 1, style: 3 }
    },
    rightPriceScale: {
      borderColor: 'rgba(255, 255, 255, 0.08)',
      scaleMargins: { top: 0.1, bottom: 0.1 }
    },
    timeScale: {
      borderColor: 'rgba(255, 255, 255, 0.08)',
      timeVisible: true,
      secondsVisible: false
    }
  });

  candleSeries = chartInstance.addCandlestickSeries({
    upColor: '#00f59b',
    downColor: '#ff3b69',
    borderUpColor: '#00f59b',
    borderDownColor: '#ff3b69',
    wickUpColor: '#00f59b',
    wickDownColor: '#ff3b69'
  });

  ema9Series = chartInstance.addLineSeries({
    color: '#00d8ff',
    lineWidth: 1.5,
    title: 'EMA 9'
  });

  ema21Series = chartInstance.addLineSeries({
    color: '#f3ba2f',
    lineWidth: 1.5,
    title: 'EMA 21'
  });

  window.addEventListener('resize', () => {
    if (chartInstance && container) {
      chartInstance.applyOptions({
        width: container.clientWidth,
        height: container.clientHeight
      });
    }
  });

  loadCandlestickChart();
}

async function loadCandlestickChart(symbol = currentChartSymbol, timeframe = currentChartTimeframe) {
  currentChartSymbol = symbol;
  currentChartTimeframe = timeframe;

  const titleElem = document.getElementById('chartSymbolTitle');
  if (titleElem) {
    const formatted = symbol.replace('USDT', '/USDT');
    titleElem.innerText = `${formatted} ${timeframe.toUpperCase()} LIVE CHART`;
  }

  try {
    const res = await API.getKlines(symbol, timeframe, 120);
    if (!res.success || !res.klines || !candleSeries) return;

    // Format for Lightweight Charts: { time: unixTimestampInSeconds, open, high, low, close }
    const formattedData = res.klines.map(k => ({
      time: Math.floor(k[0] / 1000),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4])
    }));

    // Ensure strictly ascending unique timestamps
    const uniqueMap = new Map();
    formattedData.forEach(d => uniqueMap.set(d.time, d));
    const sortedData = Array.from(uniqueMap.values()).sort((a, b) => a.time - b.time);

    candleSeries.setData(sortedData);

    // Calculate and plot EMA 9 and EMA 21 on chart
    const closes = sortedData.map(d => d.close);
    const ema9Data = calculateClientEMA(sortedData, closes, 9);
    const ema21Data = calculateClientEMA(sortedData, closes, 21);

    if (ema9Series) ema9Series.setData(ema9Data);
    if (ema21Series) ema21Series.setData(ema21Data);

    if (sortedData.length > 0) {
      const last = sortedData[sortedData.length - 1];
      const livePriceElem = document.getElementById('chartPriceLive');
      if (livePriceElem) {
        livePriceElem.innerText = `$${last.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
      }
      chartInstance.timeScale().fitContent();
    }
  } catch (err) {
    console.error('Error loading chart candles:', err);
  }
}

function calculateClientEMA(candles, closes, period) {
  if (closes.length < period) return [];
  const k = 2 / (period + 1);
  const result = [];
  
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += closes[i];
  }
  let prevEma = sum / period;
  result.push({ time: candles[period - 1].time, value: prevEma });

  for (let i = period; i < closes.length; i++) {
    const currentEma = closes[i] * k + prevEma * (1 - k);
    result.push({ time: candles[i].time, value: currentEma });
    prevEma = currentEma;
  }
  return result;
}

function changeTimeframe(tf) {
  document.querySelectorAll('.tf-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tf === tf);
  });
  loadCandlestickChart(currentChartSymbol, tf);
}
