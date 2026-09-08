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

async function inspectPaymentAndAccounts() {
  try {
    const token = await getAccessToken();
    const orgId = process.env.ZOHO_ORG_ID;
    const booksApiUrl = process.env.ZOHO_BOOKS_API_URL;

    console.log('--- 1. Search for Payment PV-000074 ---');
    const searchRes = await axios.get(
      `${booksApiUrl}/vendorpayments?payment_number=PV-000074&organization_id=${orgId}`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    );
    console.log('Search result count:', searchRes.data.vendorpayments?.length);
    if (searchRes.data.vendorpayments?.length > 0) {
      const pId = searchRes.data.vendorpayments[0].payment_id;
      const detailRes = await axios.get(`${booksApiUrl}/vendorpayments/${pId}?organization_id=${orgId}`, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` }
      });
      console.log('Payment Details:', JSON.stringify(detailRes.data.vendorpayment, null, 2));
    } else {
      console.log('Trying latest payments:');
      const latestRes = await axios.get(
        `${booksApiUrl}/vendorpayments?sort_column=created_time&sort_order=D&per_page=3&organization_id=${orgId}`,
        { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
      );
      latestRes.data.vendorpayments?.forEach(p => {
        console.log(`Payment #${p.payment_number} (ID: ${p.payment_id}, Amount: ${p.amount}, Date: ${p.date})`);
      });
    }

    console.log('\n--- 2. Check Wycherley Expense Accounts ---');
    const accRes = await axios.get(`${booksApiUrl}/chartofaccounts?organization_id=${orgId}`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` }
    });
    const accounts = accRes.data.chartofaccounts || [];
    const expenses = accounts.filter(a => a.account_type === 'expense' || a.account_type === 'other_expense');
    console.log(`Total expense accounts in Wycherley: ${expenses.length}`);
    expenses.forEach(a => {
      console.log(`- ID: ${a.account_id} | "${a.account_name}" (${a.account_type})`);
    });

  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
  }
}

inspectPaymentAndAccounts();
