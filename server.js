const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let cachedAccessToken = null;
let tokenExpiresAt = 0;
let cachedAccounts = null;
let accountsCachedAt = 0;

// ── 1. OAuth Access Token Manager ─────────────────────────────────────────────
async function getAccessToken() {
  const now = Date.now();
  if (cachedAccessToken && now < tokenExpiresAt) return cachedAccessToken;

  const response = await axios.post(
    `${process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.com'}/oauth/v2/token`,
    null,
    {
      params: {
        refresh_token: process.env.ZOHO_REFRESH_TOKEN,
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        grant_type: 'refresh_token',
      },
    }
  );

  if (response.data.error) throw new Error(`OAuth Error: ${response.data.error}`);

  cachedAccessToken = response.data.access_token;
  tokenExpiresAt = now + ((response.data.expires_in || 3600) * 1000) - 5 * 60 * 1000;
  console.log('🔑 New Access Token obtained.');
  return cachedAccessToken;
}

// ── 2. Chart of Accounts Dynamic Resolver ──────────────────────────────────────
async function getExpenseAccountId(accountName, token) {
  const orgId = process.env.ZOHO_ORG_ID;
  const booksApiUrl = process.env.ZOHO_BOOKS_API_URL || 'https://www.zohoapis.com/books/v3';
  const now = Date.now();

  // Cache accounts for 15 minutes
  if (!cachedAccounts || now - accountsCachedAt > 15 * 60 * 1000) {
    try {
      const res = await axios.get(`${booksApiUrl}/chartofaccounts?organization_id=${orgId}`, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
      });
      cachedAccounts = res.data.chartofaccounts || [];
      accountsCachedAt = now;
      console.log(`📚 Chart of Accounts loaded (${cachedAccounts.length} accounts).`);
    } catch (err) {
      console.error('⚠️ Could not refresh Chart of Accounts:', err.message);
      if (!cachedAccounts) throw err;
    }
  }

  const cleanName = (accountName || '').trim().toLowerCase();
  if (!cleanName) return null;

  // 1. Exact match
  let match = cachedAccounts.find((a) => a.account_name.trim().toLowerCase() === cleanName);

  // 2. Partial / case-insensitive match
  if (!match) {
    match = cachedAccounts.find((a) => a.account_name.toLowerCase().includes(cleanName));
  }

  return match ? { id: match.account_id, name: match.account_name } : null;
}

// ── 3. Health check endpoints ──────────────────────────────────────────────────
app.get('/', (req, res) =>
  res.json({
    status: 'Running',
    service: 'Zoho Books Auto-Adjusting Journal Service',
    description: 'Auto converts unbilled vendor payments into expense journals (Prepaid Expenses → Expense Account)',
  })
);

app.get('/webhook/vendor-payment', (req, res) => res.json({ status: 'OK' }));

// ── 4. Main Webhook Handler ────────────────────────────────────────────────────
app.post('/webhook/vendor-payment', async (req, res) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`\n========================================================`);
  console.log(`📩 [${timestamp}] Webhook received!`);
  console.log('Query:', JSON.stringify(req.query));
  console.log('Body:', JSON.stringify(req.body, null, 2));

  const orgId = process.env.ZOHO_ORG_ID;
  const booksApiUrl = process.env.ZOHO_BOOKS_API_URL || 'https://www.zohoapis.com/books/v3';

  try {
    const accessToken = await getAccessToken();

    // ── Step 1: Extract Payment identifier from webhook ──
    let rawId =
      req.query.payment_id ||
      req.query.paymentId ||
      req.body?.payment_id ||
      req.body?.vendor_payment?.payment_id ||
      req.body?.vendor_payment?.vendor_payment_id ||
      req.body?.vendor_payment?.payment_number ||
      null;

    // Discard placeholder strings (e.g. ${VENDOR_PAYMENT.PAYMENT_ID})
    if (
      rawId &&
      (rawId.includes('${') ||
        rawId.toUpperCase().includes('PAYMENT_NUMBER') ||
        rawId.toUpperCase().includes('PAYMENT_ID'))
    ) {
      console.log(`⚠️ Unresolved placeholder received: "${rawId}". Switching to auto-detect mode.`);
      rawId = null;
    }

    let targetPayment = null;

    if (rawId && rawId.trim() !== '') {
      const isShortNumber = rawId.length <= 12 && /^\d+$/.test(rawId);

      if (isShortNumber) {
        // Payment Number received (e.g. 26090832)
        console.log(`🔎 Received Payment Number: ${rawId}. Looking up in Zoho Books...`);
        const searchRes = await axios.get(
          `${booksApiUrl}/vendorpayments?payment_number=${rawId}&organization_id=${orgId}`,
          { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } }
        );
        const found = searchRes.data.vendorpayments || [];
        if (found.length > 0) {
          const pId = found[0].payment_id;
          const detailRes = await axios.get(`${booksApiUrl}/vendorpayments/${pId}?organization_id=${orgId}`, {
            headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
          });
          targetPayment = detailRes.data.vendorpayment || detailRes.data.vendor_payment;
          console.log(`✅ Resolved Payment #${rawId} → ID: ${pId}`);
        }
      } else {
        // Long Payment ID received
        console.log(`🔍 Fetching details for payment_id: ${rawId}`);
        try {
          const detailRes = await axios.get(`${booksApiUrl}/vendorpayments/${rawId}?organization_id=${orgId}`, {
            headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
          });
          targetPayment = detailRes.data.vendorpayment || detailRes.data.vendor_payment;
        } catch (e) {
          console.log(`⚠️ Could not fetch payment ${rawId} directly.`);
        }
      }
    }

    // ── Step 2: Fallback - Auto-detect latest vendor payment ──
    if (!targetPayment) {
      console.log('🔄 Auto-detecting latest Vendor Payment from Zoho Books...');
      const listRes = await axios.get(
        `${booksApiUrl}/vendorpayments?sort_column=created_time&sort_order=D&per_page=3&organization_id=${orgId}`,
        { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } }
      );
      const payments = listRes.data.vendorpayments || [];
      if (payments.length === 0) {
        console.log('ℹ️ No vendor payments found.');
        return res.status(200).json({ status: 'No payments found' });
      }
      const latestId = payments[0].payment_id;
      const detailRes = await axios.get(`${booksApiUrl}/vendorpayments/${latestId}?organization_id=${orgId}`, {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      });
      targetPayment = detailRes.data.vendorpayment || detailRes.data.vendor_payment;
      console.log(`🎯 Auto-detected latest: Payment #${targetPayment.payment_number} (ID: ${targetPayment.payment_id})`);
    }

    // ── Step 3: Analyze Payment & Bill status ──
    const paymentId = targetPayment.payment_id;
    const paymentNumber = targetPayment.payment_number;
    const vendorName = targetPayment.vendor_name || 'Vendor';
    const amount = parseFloat(targetPayment.amount || 0);
    const paymentDate = targetPayment.date || new Date().toISOString().split('T')[0];
    const paidThroughAccount = targetPayment.paid_through_account_name || 'Bank';
    const offsetAccountId = targetPayment.offset_account_id || '8807778000000093020'; // Prepaid Expenses

    const hasBills =
      (targetPayment.bills && targetPayment.bills.length > 0) ||
      (targetPayment.bill_numbers && targetPayment.bill_numbers.trim() !== '');

    console.log(`\n📊 Payment Analysis:
   --------------------------------------------------
   - Payment #:       ${paymentNumber}
   - Vendor:          ${vendorName}
   - Amount:          ${amount} ${targetPayment.currency_code || 'LKR'}
   - Date:            ${paymentDate}
   - Paid Through:    ${paidThroughAccount}
   - Has Bills:       ${hasBills ? 'YES (Bill Payment)' : 'NO (Direct / Advance Payment)'}`);

    // If payment has bills attached, it is a normal bill payment. No Journal required.
    if (hasBills) {
      console.log(`🛡️ Payment has bills attached (${targetPayment.bill_numbers}). Kept without journal entry.`);
      return res.status(200).json({
        success: true,
        action: 'ignored',
        message: `Payment #${paymentNumber} is a Bill Payment. No journal adjustment needed.`,
      });
    }

    // ── Step 4: Extract Target Expense Account from Custom Fields ──
    let customExpenseAccountName = null;

    if (targetPayment.custom_fields && Array.isArray(targetPayment.custom_fields)) {
      const expField = targetPayment.custom_fields.find(
        (cf) =>
          cf.label?.toLowerCase().includes('expense') ||
          cf.api_name?.toLowerCase().includes('expense') ||
          cf.placeholder?.toLowerCase().includes('expense')
      );
      if (expField && expField.value) {
        customExpenseAccountName = expField.value;
      }
    }

    if (!customExpenseAccountName && targetPayment.custom_field_hash) {
      for (const [k, v] of Object.entries(targetPayment.custom_field_hash)) {
        if (k.toLowerCase().includes('expense') && v) {
          customExpenseAccountName = v;
          break;
        }
      }
    }

    // Default fallback to "Travel Expense" if none specified
    const targetAccountName = customExpenseAccountName || process.env.DEFAULT_EXPENSE_ACCOUNT || 'Travel Expense';
    console.log(`🎯 Target Expense Account: "${targetAccountName}"`);

    const resolvedExpenseAccount = await getExpenseAccountId(targetAccountName, accessToken);

    if (!resolvedExpenseAccount) {
      console.error(`❌ Could not find account "${targetAccountName}" in Chart of Accounts.`);
      return res.status(400).json({
        success: false,
        error: `Expense Account "${targetAccountName}" not found in Zoho Chart of Accounts.`,
      });
    }

    console.log(`✅ Resolved Account: "${resolvedExpenseAccount.name}" (ID: ${resolvedExpenseAccount.id})`);

    // ── Step 5: Check if Journal Entry already exists (Idempotency) ──
    const journalRef = `VP-${paymentNumber}`;
    try {
      const existingJournals = await axios.get(
        `${booksApiUrl}/journals?reference_number=${journalRef}&organization_id=${orgId}`,
        { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } }
      );
      if (existingJournals.data.journals && existingJournals.data.journals.length > 0) {
        const j = existingJournals.data.journals[0];
        console.log(`ℹ️ Journal Entry for ${journalRef} already exists (ID: ${j.journal_id}). Skipping duplicate.`);
        return res.status(200).json({
          success: true,
          action: 'already_exists',
          message: `Journal Entry for Payment #${paymentNumber} already exists.`,
          journal_id: j.journal_id,
        });
      }
    } catch (e) {
      // Continue if lookup fails
    }

    // ── Step 6: Create Adjusting Journal Entry in Zoho Books ──
    const journalPayload = {
      journal_date: paymentDate,
      reference_number: journalRef,
      notes: `AJE: Transfer LKR ${amount.toFixed(2)} from Prepaid Expenses to ${resolvedExpenseAccount.name} for Vendor Payment #${paymentNumber} (${vendorName})`,
      line_items: [
        {
          account_id: resolvedExpenseAccount.id, // DEBIT: Expense Account (e.g. Travel Expense)
          debit_or_credit: 'debit',
          amount: amount,
          description: `${resolvedExpenseAccount.name} adjustment for Payment #${paymentNumber} (${vendorName})`,
        },
        {
          account_id: offsetAccountId, // CREDIT: Prepaid Expenses (Clear out the advance)
          debit_or_credit: 'credit',
          amount: amount,
          description: `Clear Prepaid Expenses for Payment #${paymentNumber}`,
        },
      ],
    };

    console.log(`📝 Creating Adjusting Journal Entry:
   - DEBIT:  ${resolvedExpenseAccount.name} (LKR ${amount.toFixed(2)})
   - CREDIT: Prepaid Expenses (LKR ${amount.toFixed(2)})
   - Ref:    ${journalRef}`);

    const journalRes = await axios.post(
      `${booksApiUrl}/journals?organization_id=${orgId}`,
      journalPayload,
      { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } }
    );

    const createdJournal = journalRes.data.journal;
    console.log(`🎉 SUCCESS! Journal Entry Created: ID: ${createdJournal.journal_id}`);

    // ── Step 7: Add Audit Comment to Vendor Payment ──
    try {
      await axios.post(
        `${booksApiUrl}/vendorpayments/${paymentId}/comments?organization_id=${orgId}`,
        { description: `✅ Auto Journal Entry created: ${resolvedExpenseAccount.name} (LKR ${amount.toFixed(2)}) [Ref: ${journalRef}]` },
        { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } }
      );
      console.log(`💬 Audit comment added to Payment #${paymentNumber}`);
    } catch (e) {
      console.log('ℹ️ Could not add comment to payment (non-critical).');
    }

    console.log(`========================================================\n`);

    return res.status(200).json({
      success: true,
      action: 'journal_created',
      message: `Adjusting Journal Entry created for Payment #${paymentNumber} (${resolvedExpenseAccount.name})!`,
      payment_id: paymentId,
      payment_number: paymentNumber,
      journal_id: createdJournal.journal_id,
      journal_entry: {
        debit: `${resolvedExpenseAccount.name} : ${amount}`,
        credit: `Prepaid Expenses : ${amount}`,
        net_effect: `${paidThroughAccount} (Credit) ➔ ${resolvedExpenseAccount.name} (Debit)`,
      },
    });

  } catch (error) {
    const errorData = error.response?.data || error.message;
    console.error('❌ Error processing webhook:', errorData);
    return res.status(500).json({ success: false, error: errorData });
  }
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`
🚀 ========================================================
   Zoho Books Auto-Adjusting Journal Service is LIVE!
   Port:    ${PORT}
   URL:     http://localhost:${PORT}
   Webhook: http://localhost:${PORT}/webhook/vendor-payment
========================================================`);
  });
}

module.exports = app;

