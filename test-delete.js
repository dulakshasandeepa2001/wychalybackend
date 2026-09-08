const axios = require('axios');
require('dotenv').config();

async function getAccessToken() {
  const res = await axios.post(`${process.env.ZOHO_ACCOUNTS_URL}/oauth/v2/token`, null, {
    params: {
      refresh_token: process.env.ZOHO_REFRESH_TOKEN,
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      grant_type: 'refresh_token',
    },
  });
  return res.data.access_token;
}

async function testDelete() {
  const paymentId = '8807778000006285129';
  const orgId = process.env.ZOHO_ORG_ID;
  const booksApiUrl = process.env.ZOHO_BOOKS_API_URL;

  try {
    const token = await getAccessToken();
    console.log(`📡 Deleting payment ${paymentId}...`);
    const res = await axios.delete(`${booksApiUrl}/vendorpayments/${paymentId}?organization_id=${orgId}`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });
    console.log('✅ Delete Result:', res.data);
  } catch (err) {
    console.error('❌ Delete Failed:', err.response?.data || err.message);
  }
}

testDelete();
