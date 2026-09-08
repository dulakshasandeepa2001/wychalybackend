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

async function testFetchLatestPayments() {
  try {
    const token = await getAccessToken();
    const booksApiUrl = process.env.ZOHO_BOOKS_API_URL;
    const orgId = process.env.ZOHO_ORG_ID;

    console.log(`📡 Fetching latest vendor payments for Org: ${orgId}...`);
    const res = await axios.get(`${booksApiUrl}/vendorpayments?sort_column=created_time&sort_order=D&per_page=5&organization_id=${orgId}`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });

    console.log('Total Vendor Payments found:', res.data.vendorpayments?.length);
    console.log('Latest Vendor Payments:', JSON.stringify(res.data.vendorpayments, null, 2));

    if (res.data.vendorpayments && res.data.vendorpayments.length > 0) {
      const top = res.data.vendorpayments[0];
      console.log(`\n🔍 Details of top payment (${top.payment_id}):`);
      const detailRes = await axios.get(`${booksApiUrl}/vendorpayments/${top.payment_id}?organization_id=${orgId}`, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
      });
      console.log('Payment Full Detail:', JSON.stringify(detailRes.data.vendor_payment, null, 2));
    }
  } catch (err) {
    console.error('Fetch error:', err.response?.data || err.message);
  }
}

testFetchLatestPayments();
