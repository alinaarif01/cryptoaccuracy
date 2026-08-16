const axios = require('axios');

const BASE_LOCAL = 'http://localhost:3000';
const BASE_VERCEL = 'https://cryptoaccuracy.vercel.app';

async function testEndpoint(name, url, method = 'GET', data = null) {
  try {
    const config = { method, url, timeout: 6000 };
    if (data) config.data = data;
    const res = await axios(config);
    console.log(`✅ [${res.status}] ${name} -> Success`);
    return { ok: true, data: res.data };
  } catch (err) {
    console.log(`❌ [${err.response?.status || 'ERR'}] ${name} -> ${err.response?.data?.error || err.message}`);
    return { ok: false, error: err.response?.data || err.message };
  }
}

async function auditAll() {
  console.log('====================================================');
  console.log('🔍 FULL BACKEND API & BINANCE ENDPOINTS AUDIT');
  console.log('====================================================\n');

  console.log('--- 1. Testing Localhost Endpoints ---');
  await testEndpoint('Tickers API', `${BASE_LOCAL}/api/binance/ticker`);
  await testEndpoint('Klines API (BTC)', `${BASE_LOCAL}/api/binance/klines?symbol=BTCUSDT&interval=5m&limit=10`);
  await testEndpoint('Account Balance API', `${BASE_LOCAL}/api/binance/account`);
  await testEndpoint('Strategy Analysis API', `${BASE_LOCAL}/api/binance/analysis?symbol=BTCUSDT`);
  await testEndpoint('Bot Status API', `${BASE_LOCAL}/api/bot`);
  await testEndpoint('Settings API', `${BASE_LOCAL}/api/settings`);

  console.log('\n--- 2. Testing Vercel Production Endpoints ---');
  await testEndpoint('Vercel Tickers API', `${BASE_VERCEL}/api/binance/ticker`);
  await testEndpoint('Vercel Klines API (ETH)', `${BASE_VERCEL}/api/binance/klines?symbol=ETHUSDT&interval=5m&limit=10`);
  await testEndpoint('Vercel Strategy Analysis API', `${BASE_VERCEL}/api/binance/analysis?symbol=ETHUSDT`);
  await testEndpoint('Vercel Bot Status API', `${BASE_VERCEL}/api/bot`);
  await testEndpoint('Vercel Settings API', `${BASE_VERCEL}/api/settings`);

  console.log('\n====================================================');
  console.log('🎯 AUDIT COMPLETED!');
  console.log('====================================================');
}

auditAll();
