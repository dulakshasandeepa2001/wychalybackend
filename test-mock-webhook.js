const axios = require('axios');

const LOCAL_SERVER_URL = 'http://localhost:3000/webhook/vendor-payment';

async function runMockTests() {
  console.log('🧪 Starting Mock Webhook Tests...\n');

  // Test Case 1: Payment with Bills (Should NOT be deleted)
  console.log('--- Test 1: Simulating Payment WITH Bills (Should be Ignored) ---');
  try {
    const res1 = await axios.post(LOCAL_SERVER_URL, {
      vendor_payment: {
        payment_id: '982000000011111',
        vendor_name: 'Test Vendor A',
        amount: 5000,
        bills: [
          {
            bill_id: '982000000022222',
            bill_number: 'BILL-001',
            amount_applied: 5000,
          },
        ],
      },
    });
    console.log('Result 1:', res1.data);
  } catch (err) {
    console.error('Test 1 Failed:', err.response?.data || err.message);
  }

  console.log('\n--------------------------------------------------------------\n');

  // Test Case 2: Payment WITHOUT Bills (Advance - Should trigger DELETE)
  console.log('--- Test 2: Simulating Payment WITHOUT Bills (Advance - Should Trigger Delete) ---');
  try {
    const res2 = await axios.post(LOCAL_SERVER_URL, {
      vendor_payment: {
        payment_id: '982000000099999',
        vendor_name: 'Test Vendor B (Advance)',
        amount: 2500,
        bills: [], // Empty bills array
      },
    });
    console.log('Result 2:', res2.data);
  } catch (err) {
    console.error('Test 2 Output (Expected error if credentials not yet configured):', err.response?.data || err.message);
  }
}

runMockTests();
