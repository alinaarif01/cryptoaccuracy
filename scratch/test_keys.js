const crypto = require('crypto');
const axios = require('axios');

const apiKey = 'OCobwBkYlnYGWKMEbkhobnRYMs9mIMw8XgMuPwHRe6oWZ130PqF3gYqXNhiAbMRG';
const apiSecret = '0Lw5wOhDzwdDv1LY5NLqAFZnmXYbP3ajT5YdYRTrSBR7nJUULTwXJXpG50mxOVzT';

function sign(queryString, secret) {
  return crypto.createHmac('sha256', secret).update(queryString).digest('hex');
}

async function testLiveBinance() {
  console.log('Testing Binance Live API...');
  const timestamp = Date.now();
  const query = `timestamp=${timestamp}`;
  const signature = sign(query, apiSecret);

  try {
    const res = await axios.get(`https://api.binance.com/api/v3/account?${query}&signature=${signature}`, {
      headers: { 'X-MBX-APIKEY': apiKey },
      timeout: 6000
    });
    console.log('✅ LIVE BINANCE SUCCESS!');
    console.log('Can Trade:', res.data.canTrade);
    const nonZero = res.data.balances.filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0);
    console.log('Account Balances:', nonZero);
  } catch (err) {
    console.log('❌ LIVE BINANCE ERROR:', err.response?.status, err.response?.data || err.message);
  }
}

async function testTestnetBinance() {
  console.log('\nTesting Binance Spot Testnet...');
  const timestamp = Date.now();
  const query = `timestamp=${timestamp}`;
  const signature = sign(query, apiSecret);

  try {
    const res = await axios.get(`https://testnet.binance.vision/api/v3/account?${query}&signature=${signature}`, {
      headers: { 'X-MBX-APIKEY': apiKey },
      timeout: 6000
    });
    console.log('✅ TESTNET SUCCESS!');
    console.log('Can Trade:', res.data.canTrade);
    const nonZero = res.data.balances.filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0);
    console.log('Account Balances:', nonZero);
  } catch (err) {
    console.log('❌ TESTNET ERROR:', err.response?.status, err.response?.data || err.message);
  }
}

async function run() {
  await testLiveBinance();
  await testTestnetBinance();
}

run();
