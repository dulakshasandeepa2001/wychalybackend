const axios = require('axios');

async function testWebhook() {
  try {
    console.log('📡 Sending test webhook to http://localhost:3000/webhook/vendor-payment...');
    const res = await axios.post('http://localhost:3000/webhook/vendor-payment', {
      payment_id: '',
    });
    console.log('✅ Response:', res.data);
  } catch (err) {
    console.error('❌ Test failed:', err.response?.data || err.message);
  }
}

testWebhook();
