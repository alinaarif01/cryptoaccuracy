const crypto = require('crypto');
const axios = require('axios');

function sign(queryString, secret) {
  return crypto.createHmac('sha256', secret).update(queryString).digest('hex');
}

async function testBothKeys() {
  const key1 = {
    apiKey: 'OCobwBkYlnYGWKMEbkhobnRYMs9mIMw8XgMuPwHRe6oWZ130PqF3gYqXNhiAbMRG',
    apiSecret: '0Lw5wOhDzwdDv1LY5NLqAFZnmXYbP3ajT5YdYRTrSBR7nJUULTwXJXpG50mxOVzT'
  };

  const key2 = {
    apiKey: 'UrRgxXFMD7sL0umV7u8LEU943pJ6cbPU1STAW8x0g3uJ2zaCRhRScTGZUZwJAbOX',
    apiSecret: 'L1ffOIr6IAC8wCUwWQ0gBzjVEPrDHlf8XWKtEu7npoRsJXHkMvAGBS5nnxoAgOSG'
  };

  for (const [idx, k] of [key1, key2].entries()) {
    console.log(`\n--- Testing API Key #${idx + 1} (${k.apiKey.substring(0, 8)}...) ---`);
    const timestamp = Date.now();
    const query = `symbol=BTCUSDT&side=BUY&type=MARKET&quoteOrderQty=10&timestamp=${timestamp}`;
    const signature = sign(query, k.apiSecret);

    try {
      const res = await axios.post(`https://api.binance.com/api/v3/order?${query}&signature=${signature}`, null, {
        headers: { 'X-MBX-APIKEY': k.apiKey },
        timeout: 6000
      });
      console.log(`✅ Key #${idx + 1} Success:`, res.data);
    } catch (err) {
      console.log(`❌ Key #${idx + 1} Result:`, err.response?.status, err.response?.data);
    }
  }
}

testBothKeys();
