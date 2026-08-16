/**
 * Technical Indicator Calculations from real Binance Candlesticks
 */

export function calculateEMA(prices, period) {
  if (!prices || prices.length < period) return [];
  const k = 2 / (period + 1);
  const emaArray = [];

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i];
  }
  let prevEma = sum / period;
  emaArray.push({ index: period - 1, value: prevEma });

  for (let i = period; i < prices.length; i++) {
    const currentEma = prices[i] * k + prevEma * (1 - k);
    emaArray.push({ index: i, value: currentEma });
    prevEma = currentEma;
  }
  return emaArray;
}

export function calculateRSI(closes, period = 14) {
  if (!closes || closes.length <= period) return [];
  const rsis = [];
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  let rsi = 100 - (100 / (1 + rs));
  rsis.push({ index: period, value: rsi });

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi = 100 - (100 / (1 + rs));
    rsis.push({ index: i, value: rsi });
  }

  return rsis;
}

export function calculateMACD(closes) {
  if (!closes || closes.length < 35) return null;
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);

  const macdLine = [];
  const ema26Map = new Map(ema26.map(item => [item.index, item.value]));
  for (const item of ema12) {
    if (ema26Map.has(item.index)) {
      macdLine.push({ index: item.index, value: item.value - ema26Map.get(item.index) });
    }
  }

  const macdValues = macdLine.map(m => m.value);
  const signalLine = calculateEMA(macdValues, 9);
  const latestMacd = macdLine[macdLine.length - 1]?.value || 0;
  const latestSignal = signalLine[signalLine.length - 1]?.value || 0;
  const histogram = latestMacd - latestSignal;

  return { macd: latestMacd, signal: latestSignal, histogram };
}

export function analyzeCandles(candles) {
  // Binance Kline format: [openTime, open, high, low, close, volume, ...]
  if (!candles || candles.length < 30) {
    return { signal: 'NEUTRAL', confidence: 0, reason: 'Waiting for live Binance candle data' };
  }

  const closes = candles.map(c => parseFloat(c[4]));
  const volumes = candles.map(c => parseFloat(c[5]));
  const currentPrice = closes[closes.length - 1];

  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const rsiData = calculateRSI(closes, 14);
  const macdData = calculateMACD(closes);

  const latestEma9 = ema9[ema9.length - 1]?.value || currentPrice;
  const prevEma9 = ema9[ema9.length - 2]?.value || latestEma9;
  const latestEma21 = ema21[ema21.length - 1]?.value || currentPrice;
  const prevEma21 = ema21[ema21.length - 2]?.value || latestEma21;

  const latestRSI = rsiData[rsiData.length - 1]?.value || 50;

  const recentVolumes = volumes.slice(-10);
  const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
  const latestVolume = volumes[volumes.length - 1];
  const volumeMultiplier = avgVolume > 0 ? (latestVolume / avgVolume) : 1;

  let buyScore = 0;
  let sellScore = 0;
  const reasons = [];

  // 1. EMA 9/21 Cross & Trend
  if (latestEma9 > latestEma21) {
    buyScore += 30;
    if (prevEma9 <= prevEma21) {
      buyScore += 20;
      reasons.push('Golden Cross: EMA 9 crossed above EMA 21');
    } else {
      reasons.push('Bullish Trend: EMA 9 > EMA 21');
    }
  } else if (latestEma9 < latestEma21) {
    sellScore += 30;
    if (prevEma9 >= prevEma21) {
      sellScore += 20;
      reasons.push('Death Cross: EMA 9 crossed below EMA 21');
    } else {
      reasons.push('Bearish Trend: EMA 9 < EMA 21');
    }
  }

  // 2. RSI 14 Momentum
  if (latestRSI > 50 && latestRSI < 68) {
    buyScore += 25;
    reasons.push(`RSI Strong Bullish (${latestRSI.toFixed(1)})`);
  } else if (latestRSI < 30) {
    buyScore += 30;
    reasons.push(`RSI Oversold Bounce Setup (${latestRSI.toFixed(1)})`);
  } else if (latestRSI < 50 && latestRSI > 32) {
    sellScore += 25;
    reasons.push(`RSI Bearish (${latestRSI.toFixed(1)})`);
  } else if (latestRSI > 70) {
    sellScore += 30;
    reasons.push(`RSI Overbought Pullback Setup (${latestRSI.toFixed(1)})`);
  }

  // 3. MACD Momentum
  if (macdData) {
    if (macdData.histogram > 0 && macdData.macd > macdData.signal) {
      buyScore += 20;
      reasons.push('MACD Bullish Histogram');
    } else if (macdData.histogram < 0 && macdData.macd < macdData.signal) {
      sellScore += 20;
      reasons.push('MACD Bearish Histogram');
    }
  }

  // 4. Volume Confirmation
  if (volumeMultiplier >= 1.25) {
    if (buyScore > sellScore) buyScore += 15;
    else if (sellScore > buyScore) sellScore += 15;
    reasons.push(`Volume Spike (${volumeMultiplier.toFixed(1)}x avg)`);
  }

  let finalSignal = 'NEUTRAL';
  let confidence = 0;

  if (buyScore >= 65 && buyScore > sellScore + 15) {
    finalSignal = 'BUY';
    confidence = Math.min(95, buyScore);
  } else if (sellScore >= 65 && sellScore > buyScore + 15) {
    finalSignal = 'SELL';
    confidence = Math.min(95, sellScore);
  } else {
    confidence = Math.max(buyScore, sellScore);
  }

  return {
    signal: finalSignal,
    confidence: Math.round(confidence),
    currentPrice,
    indicators: {
      rsi: parseFloat(latestRSI.toFixed(2)),
      ema9: parseFloat(latestEma9.toFixed(4)),
      ema21: parseFloat(latestEma21.toFixed(4)),
      macd: macdData ? parseFloat(macdData.histogram.toFixed(4)) : 0,
      volumeRatio: parseFloat(volumeMultiplier.toFixed(2))
    },
    reasons: reasons.slice(0, 3)
  };
}
