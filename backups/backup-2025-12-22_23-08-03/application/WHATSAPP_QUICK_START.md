# WhatsApp Integration - Quick Start Guide

## 🚀 Step-by-Step Setup for Actual WhatsApp Testing

Follow these steps in order to test WhatsApp integration from your mobile phone.

---

## ✅ Step 1: Install Ngrok (While You Create Account)

### Option A: Download and Install
1. Go to https://ngrok.com/download
2. Download Windows version
3. Extract to `C:\ngrok\` (or any folder)
4. Add to PATH or note the path

### Option B: Install via winget
```powershell
winget install ngrok.ngrok
```

### Verify Installation
```powershell
ngrok version
```

---

## ✅ Step 2: Authenticate Ngrok

1. **Sign up** at https://dashboard.ngrok.com/signup (you mentioned you're doing this)
2. **Get your authtoken** from: https://dashboard.ngrok.com/get-started/your-authtoken
3. **Run this command:**
   ```powershell
   ngrok config add-authtoken YOUR_AUTH_TOKEN_HERE
   ```

---

## ✅ Step 3: Set Up Twilio WhatsApp (Recommended)

### 3.1 Create Twilio Account
1. Go to https://www.twilio.com/try-twilio
2. Sign up (free account)
3. Verify your phone number

### 3.2 Enable WhatsApp Sandbox
1. Log in to https://console.twilio.com
2. Go to **Messaging** → **Try it out** → **Send a WhatsApp message**
3. Click **Get started with Twilio Sandbox for WhatsApp**
4. Note down:
   - **WhatsApp Number** (e.g., `+1 415 523 8886`)
   - **Join Code** (e.g., `join example-code`)

### 3.3 Join Sandbox from Your Phone
1. Open WhatsApp on your phone
2. Send the join code to the Twilio WhatsApp number
   - Example: Send `join example-code` to `+1 415 523 8886`
3. Wait for confirmation message

### 3.4 Get Twilio Credentials
1. In Twilio Console → **Account** → **API Keys & Tokens**
2. Copy:
   - **Account SID** (starts with `AC...`)
   - **Auth Token** (click to reveal)

---

## ✅ Step 4: Configure Environment Variables

### 4.1 Update `.env.local`

Add these lines to your `.env.local` file:

```env
# WhatsApp Configuration
WHATSAPP_VERIFY_TOKEN=your_secure_random_token_here
WHATSAPP_PROVIDER=twilio

# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

**Generate a secure verify token:**
```powershell
# Run this in PowerShell to generate a random token
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

**Replace values:**
- `TWILIO_ACCOUNT_SID`: Your Account SID from Step 3.4
- `TWILIO_AUTH_TOKEN`: Your Auth Token from Step 3.4
- `TWILIO_WHATSAPP_NUMBER`: Your Twilio WhatsApp number (format: `whatsapp:+14155238886`)

### 4.2 Restart Application

```powershell
# Stop current dev server (Ctrl+C)
# Then restart
npm run dev
```

---

## ✅ Step 5: Start Ngrok Tunnel

### 5.1 Make Sure App is Running

In one terminal:
```powershell
npm run dev
```

Wait for: `Ready on http://localhost:3001`

### 5.2 Start Ngrok

**Option A: Using npm script (easiest)**
```powershell
# In a NEW terminal window
npm run ngrok
```

**Option B: Manual command**
```powershell
ngrok http 3001
```

**Option C: Using setup script**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-ngrok.ps1
```

### 5.3 Get Your Public URL

Ngrok will display:
```
Forwarding   https://abc123def456.ngrok.io -> http://localhost:3001
```

**Copy the HTTPS URL** (the one starting with `https://`)

**Or use helper script:**
```powershell
# In another terminal
npm run ngrok-url
```

This will show your URL and copy it to clipboard.

---

## ✅ Step 6: Configure Twilio Webhook

1. Go to https://console.twilio.com
2. Navigate to **Messaging** → **Settings** → **WhatsApp Sandbox Settings**
3. In **"When a message comes in"**, enter:
   ```
   https://YOUR_NGROK_URL.ngrok.io/api/whatsapp/webhook
   ```
   Replace `YOUR_NGROK_URL` with your actual ngrok URL from Step 5.3
4. Set HTTP method to **POST**
5. Click **Save**

**Important:** Make sure you use the **HTTPS** URL (not HTTP)

---

## ✅ Step 7: Test the Integration

### 7.1 Send Test Message

1. Open WhatsApp on your phone
2. Send a message to your Twilio WhatsApp number
3. Start with: `Hello` or `MENU`

### 7.2 Expected Response

You should receive:
- Welcome message (if authenticated)
- Main menu with 4 options

### 7.3 Test Complete Flow

Try these commands:
- `MENU` - Show main menu
- `1` - Start order flow
- `2` - View past orders
- `3` - Check order status
- `4` - Show help
- `STATUS` - Check open orders

---

## 🔍 Troubleshooting

### Issue: No Response Received

**Check 1: Ngrok is Running**
```powershell
# Check ngrok web interface
# Open browser: http://localhost:4040
# You should see requests coming in
```

**Check 2: Twilio Webhook URL**
- Verify URL is correct in Twilio Console
- Make sure it's HTTPS (not HTTP)
- Check Twilio logs: **Monitor** → **Logs** → **Debugger**

**Check 3: Application Logs**
- Watch terminal where `npm run dev` is running
- Look for `[WhatsApp Webhook]` messages
- Check for errors

**Check 4: Environment Variables**
- Verify `.env.local` has all Twilio credentials
- Restart application after adding variables

### Issue: Authentication Fails

- Verify phone number format matches database
- Check phone number exists in `employees` collection
- Phone numbers are encrypted, so format must match exactly

### Issue: Webhook Not Receiving Messages

1. Test webhook URL manually:
   ```powershell
   curl -X POST https://YOUR_NGROK_URL.ngrok.io/api/whatsapp/webhook -H "Content-Type: application/json" -d '{"from":"+919876543210","message":"TEST","messageId":"test"}'
   ```

2. Check ngrok web interface: http://localhost:4040
   - See if requests are coming through
   - Check request/response details

3. Verify Twilio webhook configuration
   - URL is correct
   - Method is POST
   - Webhook is saved

---

## 📱 Testing Checklist

- [ ] Ngrok installed and authenticated
- [ ] Twilio account created
- [ ] WhatsApp sandbox joined from phone
- [ ] Environment variables configured
- [ ] Application running on port 3001
- [ ] Ngrok tunnel active
- [ ] Twilio webhook URL configured
- [ ] Test message sent from phone
- [ ] Response received on phone
- [ ] Menu navigation working
- [ ] Order flow working

---

## 🎯 Next Steps After Setup

Once basic testing works:

1. **Test Complete Order Flow**
   - Place an order end-to-end
   - Verify order appears in database
   - Check order confirmation message

2. **Test Order History**
   - View past orders
   - Check order details

3. **Test Error Handling**
   - Invalid inputs
   - Eligibility errors
   - Network errors

4. **Monitor Performance**
   - Check response times
   - Monitor ngrok usage
   - Review Twilio logs

---

## 📞 Quick Reference

**Start Everything:**
```powershell
# Terminal 1: Start app
npm run dev

# Terminal 2: Start ngrok
npm run ngrok

# Terminal 3: Get URL (optional)
npm run ngrok-url
```

**Test Webhook:**
```powershell
curl -X POST https://YOUR_NGROK_URL.ngrok.io/api/whatsapp/webhook -H "Content-Type: application/json" -d '{"from":"+919876543210","message":"MENU","messageId":"test"}'
```

**Check Logs:**
- Application: Terminal where `npm run dev` is running
- Ngrok: http://localhost:4040
- Twilio: https://console.twilio.com → Monitor → Logs

---

## ✅ You're Ready!

Once you've completed all steps:
1. ✅ Ngrok account created
2. ✅ Ngrok installed and authenticated
3. ✅ Twilio account set up
4. ✅ Webhook configured
5. ✅ Test message sent

**Send me a message when you're ready for the next step, or if you encounter any issues!**

