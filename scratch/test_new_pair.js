const crypto = require('crypto');
const axios = require('axios');

const apiKey = 'Xjd3MNEA9OxQaI8Xws6td4CorlSvMiKn4oMTs4y1OrI8q08TejkjHpzir6H12QIV';
const apiSecret = 'M9vokar9Q18BLXR1sHZXHSg2ZvpW9BoabWIwnXFNgzMlQe3zBMOIV1r0ZCDwehPT';

function sign(queryString, secret) {
  return crypto.createHmac('sha256', secret).update(queryString).digest('hex');
}

async function testExactPair() {
  console.log('Testing Exact New Binance API Pair...');
  const timestamp = Date.now();
  const query = `timestamp=${timestamp}`;
  const signature = sign(query, apiSecret);

  try {
    const res = await axios.get(`https://api.binance.com/api/v3/account?${query}&signature=${signature}`, {
      headers: { 'X-MBX-APIKEY': apiKey },
      timeout: 6000
    });
    console.log('✅ BINANCE AUTHENTICATION SUCCESSFUL!');
    console.log('Can Trade:', res.data.canTrade);

    // Test Order Call
    const orderQuery = `symbol=BTCUSDT&side=BUY&type=MARKET&quoteOrderQty=10&timestamp=${Date.now()}`;
    const orderSig = sign(orderQuery, apiSecret);
    try {
      const orderRes = await axios.post(`https://api.binance.com/api/v3/order?${orderQuery}&signature=${orderSig}`, null, {
        headers: { 'X-MBX-APIKEY': apiKey },
        timeout: 6000
      });
      console.log('✅ Live Order Execution Passed:', orderRes.data);
    } catch (orderErr) {
      console.log('Live Order Test Status:', orderErr.response?.status, orderErr.response?.data);
    }
  } catch (err) {
    console.log('❌ Error:', err.response?.status, err.response?.data || err.message);
  }
}

testExactPair();
