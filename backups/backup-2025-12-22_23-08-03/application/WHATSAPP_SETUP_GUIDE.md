# WhatsApp Integration - Complete Setup Guide for Actual WhatsApp Testing

This guide will help you set up the WhatsApp integration to work with actual WhatsApp messages from your mobile phone.

## 📋 Prerequisites Checklist

- [ ] ngrok account created (you mentioned you're doing this)
- [ ] ngrok installed on your computer
- [ ] WhatsApp Business API account (Twilio or Meta/Facebook)
- [ ] UDS application running locally

---

## Step 1: Install and Configure Ngrok

### 1.1 Install Ngrok

**Option A: Download from website**
1. Go to https://ngrok.com/download
2. Download Windows version
3. Extract to a folder (e.g., `C:\ngrok\`)
4. Add to PATH or note the path

**Option B: Install via winget (Windows)**
```powershell
winget install ngrok.ngrok
```

### 1.2 Authenticate Ngrok

1. Sign up at https://dashboard.ngrok.com/signup (if you haven't already)
2. Get your authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken
3. Run this command in PowerShell:
   ```powershell
   ngrok config add-authtoken YOUR_AUTH_TOKEN_HERE
   ```

### 1.3 Verify Ngrok Installation

```powershell
ngrok version
```

You should see the version number.

---

## Step 2: Choose WhatsApp Provider

You have two main options:

### Option A: Twilio WhatsApp API (Recommended for Testing)
- ✅ Easier to set up
- ✅ Sandbox available for free testing
- ✅ Good documentation
- ⚠️ Sandbox requires joining with a code

### Option B: Meta WhatsApp Business API
- ✅ Official WhatsApp Business API
- ✅ Production-ready
- ⚠️ Requires business verification
- ⚠️ More complex setup

**For testing, we recommend Twilio.** Let's proceed with Twilio setup.

---

## Step 3: Set Up Twilio WhatsApp (Recommended)

### 3.1 Create Twilio Account

1. Go to https://www.twilio.com/try-twilio
2. Sign up for a free account
3. Verify your phone number
4. Complete account setup

### 3.2 Enable WhatsApp Sandbox

1. Log in to Twilio Console: https://console.twilio.com
2. Go to **Messaging** → **Try it out** → **Send a WhatsApp message**
3. Click **Get started with Twilio Sandbox for WhatsApp**
4. You'll see a WhatsApp number (e.g., `+1 415 523 8886`) and a join code (e.g., `join <code>`)

### 3.3 Join Twilio Sandbox from Your Phone

1. Open WhatsApp on your phone
2. Send the join code to the Twilio WhatsApp number
   - Example: Send `join example-code` to `+1 415 523 8886`
3. You'll receive a confirmation message

### 3.4 Get Twilio Credentials

From Twilio Console:
1. Go to **Account** → **API Keys & Tokens**
2. Note down:
   - **Account SID** (starts with `AC...`)
   - **Auth Token** (click to reveal)

---

## Step 4: Configure Environment Variables

### 4.1 Add to `.env.local`

Create or update `.env.local` in your project root:

```env
# WhatsApp Configuration
WHATSAPP_VERIFY_TOKEN=your_secure_random_token_here

# Twilio Configuration (if using Twilio)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# Ngrok (optional, for automatic URL detection)
NGROK_ENABLED=true
```

**Generate a secure verify token:**
```powershell
# In PowerShell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

### 4.2 Restart Your Application

After adding environment variables:
```powershell
npm run dev
```

---

## Step 5: Start Ngrok Tunnel

### 5.1 Start Your Application

In one terminal:
```powershell
npm run dev
```

Wait for it to start on port 3001.

### 5.2 Start Ngrok

**Option A: Using the provided script**
```powershell
npm run ngrok
```

**Option B: Manual command**
```powershell
ngrok http 3001
```

**Option C: Using the setup script**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-ngrok.ps1
```

### 5.3 Get Your Public URL

Ngrok will display something like:
```
Forwarding   https://abc123def456.ngrok.io -> http://localhost:3001
```

**Copy the HTTPS URL** (e.g., `https://abc123def456.ngrok.io`)

**Or use the helper script:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/get-ngrok-url.ps1
```

This will show your public URL and copy it to clipboard.

---

## Step 6: Configure Twilio Webhook

### 6.1 Set Webhook URL in Twilio

1. Go to Twilio Console: https://console.twilio.com
2. Navigate to **Messaging** → **Settings** → **WhatsApp Sandbox Settings**
3. In **When a message comes in**, enter:
   ```
   https://YOUR_NGROK_URL.ngrok.io/api/whatsapp/webhook
   ```
   Replace `YOUR_NGROK_URL` with your actual ngrok URL
4. Set HTTP method to **POST**
5. Click **Save**

### 6.2 Test Webhook

1. In Twilio Console, go to **Monitor** → **Logs** → **Debugger**
2. Send a test message from your phone to the Twilio WhatsApp number
3. Check the logs to see if webhook is being called

---

## Step 7: Create WhatsApp Message Sender Service

We need to create a service to send WhatsApp messages back to users (Twilio API integration).

### 7.1 Install Twilio SDK

```powershell
npm install twilio
```

### 7.2 Create Message Sender

Create `lib/whatsapp/message-sender.ts` (we'll do this in the next step)

---

## Step 8: Update Webhook to Send Messages

The webhook currently only processes incoming messages. We need to integrate with Twilio's API to send responses.

**Note:** The current webhook returns a JSON response, but Twilio needs us to either:
1. Return TwiML (Twilio Markup Language) for simple responses
2. Use Twilio API to send messages asynchronously

We'll implement option 2 (better for complex responses).

---

## Step 9: Test the Integration

### 9.1 Send Test Message

1. Open WhatsApp on your phone
2. Send a message to your Twilio WhatsApp number
3. Start with: `MENU` or `Hello`

### 9.2 Expected Flow

1. You send: `Hello`
2. System authenticates you (if phone number matches)
3. System responds with welcome message and menu
4. You can then interact with the menu

### 9.3 Troubleshooting

**Issue: No response received**
- Check ngrok is running and URL is correct
- Check Twilio webhook URL is set correctly
- Check Twilio logs for errors
- Check your application logs

**Issue: Authentication fails**
- Verify your phone number format matches database
- Check phone number is registered in employees collection
- Check server logs for specific errors

**Issue: Webhook not receiving messages**
- Verify ngrok tunnel is active
- Check Twilio webhook configuration
- Test webhook URL manually with curl/Postman

---

## Step 10: Monitor and Debug

### 10.1 Application Logs

Watch your terminal where `npm run dev` is running. Look for:
- `[WhatsApp Webhook]` - Incoming messages
- `[WhatsApp]` - State machine processing

### 10.2 Twilio Logs

1. Go to Twilio Console → **Monitor** → **Logs**
2. Check **Debugger** for webhook calls
3. Check **Messaging** for message status

### 10.3 Ngrok Web Interface

Open in browser: http://localhost:4040
- See all HTTP requests
- Inspect request/response payloads
- Replay requests for testing

---

## Alternative: Meta WhatsApp Business API Setup

If you prefer Meta/Facebook WhatsApp Business API:

### Step 1: Create Meta Business Account

1. Go to https://business.facebook.com
2. Create a business account
3. Complete business verification

### Step 2: Set Up WhatsApp Business API

1. Go to Meta for Developers: https://developers.facebook.com
2. Create a new app
3. Add WhatsApp product
4. Get your:
   - **Phone Number ID**
   - **WhatsApp Business Account ID**
   - **Temporary Access Token** (for testing)
   - **Permanent Access Token** (for production)

### Step 3: Configure Webhook

1. In Meta App Dashboard → **WhatsApp** → **Configuration**
2. Set **Webhook URL**: `https://YOUR_NGROK_URL.ngrok.io/api/whatsapp/webhook`
3. Set **Verify Token**: (same as `WHATSAPP_VERIFY_TOKEN` in `.env.local`)
4. Subscribe to **messages** event
5. Click **Verify and Save**

### Step 4: Test

Send a message from your phone to your WhatsApp Business number.

---

## Next Steps After Setup

Once everything is working:

1. ✅ Test complete order flow
2. ✅ Test order history
3. ✅ Test order status
4. ✅ Test error handling
5. ✅ Test with multiple users
6. ✅ Monitor performance
7. ✅ Set up production environment (replace ngrok with actual domain)

---

## Quick Reference Commands

```powershell
# Start application
npm run dev

# Start ngrok (in separate terminal)
npm run ngrok

# Get ngrok URL
powershell -ExecutionPolicy Bypass -File scripts/get-ngrok-url.ps1

# Test webhook locally
curl -X POST http://localhost:3001/api/whatsapp/webhook -H "Content-Type: application/json" -d '{"from":"+919876543210","message":"MENU","messageId":"test"}'
```

---

## Support

If you encounter issues:
1. Check server logs
2. Check Twilio/Meta logs
3. Check ngrok web interface (http://localhost:4040)
4. Verify environment variables
5. Test webhook URL manually

Let me know when you've completed the ngrok setup, and I'll help you with the next steps!

