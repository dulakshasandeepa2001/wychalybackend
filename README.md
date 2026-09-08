# Zoho Books Auto-Adjusting Journal Entry Service

Zoho Books හි බිල්පත් නොමැතිව ඇතුළත් කරන Vendor Payments (Payments Made) සඳහා ස්වයංක්‍රීයව **Adjusting Journal Entry** එකක් සාදන Node.js Webhook Service එක.

---

### 📊 Accounting Logic:

1. **Vendor Payment (Zoho Books):**
   - **DEBIT:** `Prepaid Expenses`
   - **CREDIT:** `Sampath Bank` (හෝ අදාළ බැංකුව)

2. **Auto Journal Entry (Created by this Webhook):**
   - **DEBIT:** `Travel Expense` (හෝ ඔබ Custom Field එකෙන් තෝරාගත් Expense Account එක)
   - **CREDIT:** `Prepaid Expenses`

3. **🎯 අවසාන ප්‍රතිඵලය (Net Result):**
   - `Prepaid Expenses` = **0.00 (Clear වේ)**
   - `Travel Expense` = **Debit (Profit & Loss එකේ වියදම සටහන් වේ)**
   - `Sampath Bank` = **Credit (බැංකුවෙන් මුදල් අඩු වේ)**
   - **Vendor Payment Voucher එක delete නොවේ!** (Payment History සහ Print Voucher සුරක්ෂිතව පවතී).

---

## 🚀 Quick Setup & Run

### 1. Server එක Start කරන්න:
```bash
node server.js
```
*(හෝ `npm run dev`)*

### 2. Ngrok Tunnel එක Run කරන්න:
```bash
npx ngrok http 3000
```

### 3. Webhook URL එක Zoho Books වලට ලබාදෙන්න:
```text
https://your-ngrok-url.ngrok-free.app/webhook/vendor-payment
```
