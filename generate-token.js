const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const code = process.argv[2];

if (!code) {
  console.log(`
❌ Error: Please provide the Grant Token (Code)!
Usage: node generate-token.js <YOUR_GRANT_CODE>
Example: node generate-token.js 1000.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  `);
  process.exit(1);
}

async function generateRefreshToken() {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const accountsUrl = process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.com';

  console.log(`🔑 Exchanging Grant Token for Refresh Token with ${accountsUrl}...`);

  try {
    const res = await axios.post(`${accountsUrl}/oauth/v2/token`, null, {
      params: {
        code: code.trim(),
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
      },
    });

    if (res.data.error) {
      console.error('❌ Zoho Error:', res.data.error);
      return;
    }

    const { refresh_token, access_token } = res.data;

    if (!refresh_token) {
      console.warn('⚠️ No refresh_token returned. (Ensure scope was valid and code wasn\'t used already)');
      console.log('Response:', res.data);
      return;
    }

    console.log('\n🎉 SUCCESS! Refresh Token obtained:');
    console.log(`ZOHO_REFRESH_TOKEN=${refresh_token}\n`);

    // Fetch Organization ID automatically using Access Token
    let orgId = '';
    try {
      const booksApiUrl = process.env.ZOHO_BOOKS_API_URL || 'https://www.zohoapis.com/books/v3';
      const orgRes = await axios.get(`${booksApiUrl}/organizations`, {
        headers: { Authorization: `Zoho-oauthtoken ${access_token}` },
      });

      const organizations = orgRes.data.organizations || [];
      if (organizations.length > 0) {
        orgId = organizations[0].organization_id;
        console.log(`🏢 Auto-detected Organization: "${organizations[0].name}" (ID: ${orgId})`);
      }
    } catch (e) {
      console.log('ℹ️ Could not auto-fetch Organization ID (you can fill it manually if needed).');
    }

    // Update .env file automatically
    const envPath = path.join(__dirname, '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');

    envContent = envContent.replace(/ZOHO_REFRESH_TOKEN=.*/, `ZOHO_REFRESH_TOKEN=${refresh_token}`);
    if (orgId) {
      envContent = envContent.replace(/ZOHO_ORG_ID=.*/, `ZOHO_ORG_ID=${orgId}`);
    }

    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('💾 Successfully saved ZOHO_REFRESH_TOKEN and ZOHO_ORG_ID to .env file!');

  } catch (err) {
    console.error('❌ Request failed:', err.response?.data || err.message);
  }
}

generateRefreshToken();
