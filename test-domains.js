const axios = require('axios');
require('dotenv').config();

const code = '1000.2ce63d326d53ab7a427a9d93e094a0e9.9e1312a96e7ff105cb9fb0e08356dbd8';
const clientId = process.env.ZOHO_CLIENT_ID;
const clientSecret = process.env.ZOHO_CLIENT_SECRET;

const domains = [
  { name: 'US (.com)', accounts: 'https://accounts.zoho.com', api: 'https://www.zohoapis.com/books/v3' },
  { name: 'India (.in)', accounts: 'https://accounts.zoho.in', api: 'https://www.zohoapis.in/books/v3' },
  { name: 'Europe (.eu)', accounts: 'https://accounts.zoho.eu', api: 'https://www.zohoapis.eu/books/v3' },
  { name: 'Australia (.com.au)', accounts: 'https://accounts.zoho.com.au', api: 'https://www.zohoapis.com.au/books/v3' },
];

async function tryDomains() {
  for (const domain of domains) {
    console.log(`Trying ${domain.name} (${domain.accounts})...`);
    try {
      const res = await axios.post(`${domain.accounts}/oauth/v2/token`, null, {
        params: {
          code: code.trim(),
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'authorization_code',
        },
      });

      console.log(`Response from ${domain.name}:`, res.data);
      if (res.data.refresh_token) {
        console.log(`🎉 SUCCESS on ${domain.name}!`);
        return;
      }
    } catch (err) {
      console.log(`Failed on ${domain.name}:`, err.response?.data || err.message);
    }
  }
}

tryDomains();
