const crypto = require('crypto');
const axios = require('axios');

const apiKey = 'Xjd3MNEA9OxQaI8Xws6td4CorlSvMiKn4oMTs4y1OrI8q08TejkjHpzir6H12QIV';
const apiSecret = 'M9vokar9Q18BLXR1sHZXHSg2ZvpW9BoabWIwnXFNgzMlQe3zBMOIV1r0ZCDwehPT';

function sign(queryString, secret) {
  return crypto.createHmac('sha256', secret).update(queryString).digest('hex');
}

async function testCurrentStatus() {
  console.log('Testing live order execution on Binance with latest Xjd3... key:');
  const timestamp = Date.now();
  const query = `symbol=BTCUSDT&side=BUY&type=MARKET&quoteOrderQty=10&timestamp=${timestamp}`;
  const signature = sign(query, apiSecret);

  try {
    const res = await axios.post(`https://api.binance.com/api/v3/order?${query}&signature=${signature}`, null, {
      headers: { 'X-MBX-APIKEY': apiKey },
      timeout: 6000
    });
    console.log('✅ Order Success Response:', res.data);
  } catch (err) {
    console.log('Status Code:', err.response?.status);
    console.log('Binance Error Response Body:', err.response?.data);
  }
}

testCurrentStatus();
