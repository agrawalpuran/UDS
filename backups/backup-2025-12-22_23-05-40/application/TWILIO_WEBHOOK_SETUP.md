# Twilio WhatsApp Webhook Configuration - Step by Step

## Step 1: Configure WhatsApp Sandbox Webhook

### Method 1: Via WhatsApp Sandbox Settings (Recommended)

1. **Go to Twilio Console**
   - Open: https://console.twilio.com
   - Log in with your Twilio account

2. **Navigate to WhatsApp Sandbox**
   - In the left sidebar, click **"Messaging"**
   - Click **"Try it out"** (or look for "Try it out" section)
   - Click **"Send a WhatsApp message"**
   - OR go directly to: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn

3. **Access Sandbox Settings**
   - Look for **"WhatsApp Sandbox Settings"** or **"Sandbox Configuration"**
   - Click on it to open settings
   - OR go directly to: https://console.twilio.com/us1/develop/sms/sandbox/whatsapp-sandbox

4. **Configure Webhook URL**
   - Find the field: **"When a message comes in"**
   - Enter your ngrok webhook URL:
     ```
     https://herpetological-aleida-unawarely.ngrok-free.dev/api/whatsapp/webhook
     ```
   - Set **HTTP method** to: **POST**
   - Click **"Save"** button

### Method 2: Via Messaging Settings

1. Go to: https://console.twilio.com
2. Click **"Messaging"** in left sidebar
3. Click **"Settings"** (gear icon or Settings link)
4. Look for **"WhatsApp"** section
5. Click **"WhatsApp Sandbox"** or **"Configure"**
6. Enter webhook URL and save

---

## Step 2: Find Logs and Debugger

### Option A: Monitor → Logs → Debugger

1. **Go to Monitor Section**
   - In Twilio Console left sidebar, click **"Monitor"**
   - If you don't see it, look for **"Logs"** or **"Debugger"** in the top navigation

2. **Access Logs**
   - Under Monitor, click **"Logs"**
   - You'll see sub-options:
     - **Debugger** - Webhook calls and errors
     - **Messaging** - SMS/WhatsApp message logs
     - **Calls** - Call logs

3. **Open Debugger**
   - Click **"Debugger"**
   - Direct link: https://console.twilio.com/us1/monitor/logs/debugger

### Option B: Direct Links

**Debugger (Webhook Logs):**
```
https://console.twilio.com/us1/monitor/logs/debugger
```

**Messaging Logs (WhatsApp Messages):**
```
https://console.twilio.com/us1/monitor/logs/messaging
```

**All Logs:**
```
https://console.twilio.com/us1/monitor/logs
```

### Option C: Search in Console

1. Use the **search bar** at the top of Twilio Console
2. Type: **"debugger"** or **"logs"**
3. Click on the suggested result

---

## Step 3: Verify Webhook Configuration

### Check Webhook is Set

1. Go to WhatsApp Sandbox Settings (Step 1 above)
2. Verify the webhook URL is saved:
   ```
   https://herpetological-aleida-unawarely.ngrok-free.dev/api/whatsapp/webhook
   ```

### Test Webhook

1. **Send a test message from your phone:**
   - Open WhatsApp
   - Send a message to your Twilio WhatsApp number
   - Send: `Hello` or `MENU`

2. **Check Debugger:**
   - Go to: https://console.twilio.com/us1/monitor/logs/debugger
   - Look for a POST request to your webhook URL
   - Click on it to see request/response details

3. **Check Messaging Logs:**
   - Go to: https://console.twilio.com/us1/monitor/logs/messaging
   - You should see your message being sent/received

---

## Step 4: Troubleshooting

### Issue: Can't Find Debugger

**Solution 1: Use Direct Link**
- Go to: https://console.twilio.com/us1/monitor/logs/debugger

**Solution 2: Check Your Region**
- Twilio URLs may vary by region
- If `us1` doesn't work, try:
  - `us2`: https://console.twilio.com/us2/monitor/logs/debugger
  - Or check your account region in Twilio Console settings

**Solution 3: Use Search**
- Click the search icon (magnifying glass) in Twilio Console
- Type "debugger" and select from results

### Issue: Webhook Not Receiving Messages

1. **Verify ngrok is running:**
   - Check: http://localhost:4040
   - Make sure tunnel is active

2. **Verify webhook URL in Twilio:**
   - Go to WhatsApp Sandbox Settings
   - Check URL is correct and saved

3. **Check webhook is accessible:**
   - Open in browser: `https://herpetological-aleida-unawarely.ngrok-free.dev/api/whatsapp/webhook`
   - You should see a response (not an error)

4. **Check Debugger for errors:**
   - Look for red error entries
   - Check error messages

### Issue: Messages Not Being Sent Back

1. **Check your application logs:**
   - Watch terminal where `npm run dev` is running
   - Look for `[WhatsApp Webhook]` messages
   - Check for errors

2. **Verify Twilio credentials in .env.local:**
   - `TWILIO_ACCOUNT_SID` is set
   - `TWILIO_AUTH_TOKEN` is set
   - `TWILIO_WHATSAPP_NUMBER` is set (format: `whatsapp:+14155238886`)

3. **Check Twilio logs:**
   - Go to Messaging → Logs
   - See if outbound messages are being attempted

---

## Quick Reference Links

**WhatsApp Sandbox Settings:**
```
https://console.twilio.com/us1/develop/sms/sandbox/whatsapp-sandbox
```

**Debugger (Webhook Logs):**
```
https://console.twilio.com/us1/monitor/logs/debugger
```

**Messaging Logs:**
```
https://console.twilio.com/us1/monitor/logs/messaging
```

**Main Console:**
```
https://console.twilio.com
```

---

## Current Configuration

**Your ngrok URL:**
```
https://herpetological-aleida-unawarely.ngrok-free.dev
```

**Your webhook URL (for Twilio):**
```
https://herpetological-aleida-unawarely.ngrok-free.dev/api/whatsapp/webhook
```

**Use this exact URL in Twilio WhatsApp Sandbox Settings!**

