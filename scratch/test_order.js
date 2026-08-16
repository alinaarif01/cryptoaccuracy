const crypto = require('crypto');
const axios = require('axios');

const apiKey = 'UrRgxXFMD7sL0umV7u8LEU943pJ6cbPU1STAW8x0g3uJ2zaCRhRScTGZUZwJAbOX';
const apiSecret = 'L1ffOIr6IAC8wCUwWQ0gBzjVEPrDHlf8XWKtEu7npoRsJXHkMvAGBS5nnxoAgOSG';

function sign(queryString, secret) {
  return crypto.createHmac('sha256', secret).update(queryString).digest('hex');
}

async function testPermission() {
  console.log('Testing Binance API Permissions with Updated Keys...');
  const timestamp = Date.now();
  const params = {
    symbol: 'BTCUSDT',
    side: 'BUY',
    type: 'MARKET',
    quoteOrderQty: 10,
    timestamp
  };

  const queryString = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const signature = sign(queryString, apiSecret);

  try {
    const res = await axios.post(`https://api.binance.com/api/v3/order?${queryString}&signature=${signature}`, null, {
      headers: { 'X-MBX-APIKEY': apiKey },
      timeout: 6000
    });
    console.log('✅ ORDER SUCCESS:', res.data);
  } catch (err) {
    console.log('Status Code:', err.response?.status);
    console.log('Response Body:', err.response?.data);
  }
}

testPermission();
