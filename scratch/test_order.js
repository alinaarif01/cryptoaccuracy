const crypto = require('crypto');
const axios = require('axios');

const apiKey = 'OCobwBkYlnYGWKMEbkhobnRYMs9mIMw8XgMuPwHRe6oWZ130PqF3gYqXNhiAbMRG';
const apiSecret = '0Lw5wOhDzwdDv1LY5NLqAFZnmXYbP3ajT5YdYRTrSBR7nJUULTwXJXpG50mxOVzT';

function sign(queryString, secret) {
  return crypto.createHmac('sha256', secret).update(queryString).digest('hex');
}

async function testOrder() {
  const timestamp = Date.now();
  const params = {
    symbol: 'BTCUSDT',
    side: 'BUY',
    type: 'MARKET',
    quoteOrderQty: 15,
    timestamp
  };

  const queryString = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const signature = sign(queryString, apiSecret);

  try {
    const res = await axios.post(`https://api.binance.com/api/v3/order?${queryString}&signature=${signature}`, null, {
      headers: { 'X-MBX-APIKEY': apiKey }
    });
    console.log('Order Response:', res.data);
  } catch (err) {
    console.log('Error Status:', err.response?.status);
    console.log('Error Data:', err.response?.data);
  }
}

testOrder();
