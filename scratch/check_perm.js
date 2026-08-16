const crypto = require('crypto');
const axios = require('axios');

const apiKey = 'UrRgxXFMD7sL0umV7u8LEU943pJ6cbPU1STAW8x0g3uJ2zaCRhRScTGZUZwJAbOX';
const apiSecret = 'L1ffOIr6IAC8wCUwWQ0gBzjVEPrDHlf8XWKtEu7npoRsJXHkMvAGBS5nnxoAgOSG';

function sign(queryString, secret) {
  return crypto.createHmac('sha256', secret).update(queryString).digest('hex');
}

async function checkPermission() {
  console.log('Testing Binance API Permissions for UrRgx Key...');
  const timestamp = Date.now();
  const query = `symbol=BTCUSDT&side=BUY&type=MARKET&quoteOrderQty=10&timestamp=${timestamp}`;
  const signature = sign(query, apiSecret);

  try {
    const res = await axios.post(`https://api.binance.com/api/v3/order?${query}&signature=${signature}`, null, {
      headers: { 'X-MBX-APIKEY': apiKey },
      timeout: 6000
    });
    console.log('✅ Success:', res.data);
  } catch (err) {
    console.log('Status Code:', err.response?.status);
    console.log('Response Body:', err.response?.data);
  }
}

checkPermission();
