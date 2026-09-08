const axios = require('axios');
require('dotenv').config();

async function checkPaymentFields() {
  const res = await axios.post(`${process.env.ZOHO_ACCOUNTS_URL}/oauth/v2/token`, null, {
    params: {
      refresh_token: process.env.ZOHO_REFRESH_TOKEN,
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      grant_type: 'refresh_token',
    },
  });
  const token = res.data.access_token;
  const orgId = process.env.ZOHO_ORG_ID;
  const booksApiUrl = process.env.ZOHO_BOOKS_API_URL;

  const searchRes = await axios.get(
    `${booksApiUrl}/vendorpayments?payment_number=PV-000074&organization_id=${orgId}`,
    { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
  );
  const pId = searchRes.data.vendorpayments[0].payment_id;
  const detailRes = await axios.get(`${booksApiUrl}/vendorpayments/${pId}?organization_id=${orgId}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` }
  });
  const vp = detailRes.data.vendorpayment;

  console.log('--- Custom Fields ---');
  console.log(vp.custom_fields);
  console.log('--- Custom Field Hash ---');
  console.log(vp.custom_field_hash);
  console.log('--- Location / Branch ---');
  console.log({ location_id: vp.location_id, branch_id: vp.branch_id });
  console.log('--- Offset Account ---');
  console.log({ offset_account_id: vp.offset_account_id, offset_account_name: vp.offset_account_name });
}

checkPaymentFields();
