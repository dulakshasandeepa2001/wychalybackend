const axios = require('axios');
require('dotenv').config();

async function testWycherleyJournal() {
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

  // 1. Search for "Student Refundable Deposits" in Chart of Accounts
  const accRes = await axios.get(`${booksApiUrl}/chartofaccounts?organization_id=${orgId}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` }
  });
  const accounts = accRes.data.chartofaccounts || [];
  
  const targetAcc = accounts.find(a => a.account_name.toLowerCase().includes('student refundable deposit') || a.account_name.toLowerCase().includes('refundable deposit'));
  console.log('Target account found:', targetAcc);

  const prepaidAcc = accounts.find(a => a.account_name.toLowerCase() === 'prepaid expenses');
  console.log('Prepaid account found:', prepaidAcc);

  if (targetAcc && prepaidAcc) {
    const journalPayload = {
      journal_date: '2026-09-08',
      reference_number: 'VP-PV-000074',
      notes: 'AJE: Transfer LKR 256,404.00 from Prepaid Expenses to Student Refundable Deposits for PV-000074 (P.A.V.L. Perera)',
      location_id: '1193287000000094057', // Colombo
      branch_id: '1193287000000094057',
      line_items: [
        {
          account_id: targetAcc.account_id,
          debit_or_credit: 'debit',
          amount: 256404.00,
          description: 'Student Refundable Deposits for PV-000074',
          location_id: '1193287000000094057',
        },
        {
          account_id: prepaidAcc.account_id,
          debit_or_credit: 'credit',
          amount: 256404.00,
          description: 'Clear Prepaid Expenses for PV-000074',
          location_id: '1193287000000094057',
        }
      ]
    };

    try {
      const jRes = await axios.post(`${booksApiUrl}/journals?organization_id=${orgId}`, journalPayload, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` }
      });
      console.log('✅ Journal created successfully in Wycherley!', jRes.data.journal?.journal_id);
    } catch (e) {
      console.error('❌ Journal creation failed:', e.response?.data || e.message);
    }
  }
}

testWycherleyJournal();
