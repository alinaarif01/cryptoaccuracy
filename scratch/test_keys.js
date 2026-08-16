const crypto = require('crypto');
const axios = require('axios');

const apiKey = 'UrRgxXFMD7sL0umV7u8LEU943pJ6cbPU1STAW8x0g3uJ2zaCRhRScTGZUZwJAbOX';
const apiSecret = 'L1ffOIr6IAC8wCUwWQ0gBzjVEPrDHlf8XWKtEu7npoRsJXHkMvAGBS5nnxoAgOSG';

function sign(queryString, secret) {
  return crypto.createHmac('sha256', secret).update(queryString).digest('hex');
}

async function testNewKeys() {
  console.log('Testing New Binance Live API Keys...');
  const timestamp = Date.now();
  const query = `timestamp=${timestamp}`;
  const signature = sign(query, apiSecret);

  try {
    const res = await axios.get(`https://api.binance.com/api/v3/account?${query}&signature=${signature}`, {
      headers: { 'X-MBX-APIKEY': apiKey },
      timeout: 6000
    });
    console.log('✅ NEW API KEYS VERIFIED!');
    console.log('Can Trade:', res.data.canTrade);
    console.log('Account Status: Ready');
  } catch (err) {
    console.log('❌ ERROR:', err.response?.status, err.response?.data || err.message);
  }
}

testNewKeys();
