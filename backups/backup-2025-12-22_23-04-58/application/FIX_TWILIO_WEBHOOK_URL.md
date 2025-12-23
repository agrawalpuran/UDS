# Fix: Twilio Certificate Error - Incorrect Webhook URL

## Problem Identified

Your Twilio webhook URL is **incorrect**. It shows:
```
❌ https://herpetological-aleida-unawarely.ngrok-free.dev.ngrok.io/api/whatsapp/webhook
```

Notice the **double domain**: `.ngrok-free.dev.ngrok.io` - this is wrong!

## Correct URL

The correct URL should be:
```
✅ https://herpetological-aleida-unawarely.ngrok-free.dev/api/whatsapp/webhook
```

## How to Fix

### Step 1: Get Your Correct ngrok URL

1. Open ngrok web interface: http://localhost:4040
2. Look for the "Forwarding" section
3. Copy the HTTPS URL (should end with `.ngrok-free.dev` or `.ngrok.io`, NOT both)

OR run this command:
```powershell
Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" | Select-Object -ExpandProperty tunnels | Select-Object -First 1 | Select-Object -ExpandProperty public_url
```

### Step 2: Update Twilio Webhook URL

1. **Go to Twilio Console:**
   - Direct link: https://console.twilio.com/us1/develop/sms/sandbox/whatsapp-sandbox

2. **Find "When a message comes in" field**

3. **Delete the current (incorrect) URL**

4. **Enter the CORRECT URL:**
   ```
   https://herpetological-aleida-unawarely.ngrok-free.dev/api/whatsapp/webhook
   ```
   (Use your actual ngrok URL - check ngrok dashboard to confirm)

5. **Make sure:**
   - URL starts with `https://`
   - URL ends with `/api/whatsapp/webhook`
   - NO double domains (like `.ngrok-free.dev.ngrok.io`)
   - HTTP method is set to **POST**

6. **Click "Save"**

### Step 3: Verify

1. **Check ngrok dashboard:** http://localhost:4040
   - Should show requests coming through

2. **Test webhook manually:**
   ```powershell
   Invoke-WebRequest -Uri "https://herpetological-aleida-unawarely.ngrok-free.dev/api/whatsapp/webhook" -Method GET
   ```

3. **Send a test WhatsApp message**
   - Check Twilio logs again
   - Should see successful webhook calls (not certificate errors)

---

## Additional Notes

### About Certificate Errors

Even with the correct URL, you might still see certificate warnings with ngrok free domains. This is normal and may not prevent webhooks from working.

**If webhooks still don't work after fixing the URL:**

1. **Deploy to Vercel (Recommended):**
   - Free, proper SSL certificate
   - No certificate issues
   - Production-ready

2. **Use ngrok paid plan:**
   - Static domain with proper SSL
   - No certificate issues

3. **Check if webhook is actually working:**
   - Even with certificate warnings, webhooks might work
   - Check your application logs
   - Check ngrok dashboard for incoming requests

---

## Quick Checklist

- [ ] Get correct ngrok URL from http://localhost:4040
- [ ] Update Twilio webhook URL (remove double domain)
- [ ] Verify URL format: `https://[domain].ngrok-free.dev/api/whatsapp/webhook`
- [ ] Set HTTP method to POST
- [ ] Save changes
- [ ] Test with WhatsApp message
- [ ] Check ngrok dashboard for requests
- [ ] Check application logs for `[WhatsApp Webhook]` messages

---

## Current Correct URL (if ngrok is still running)

Check your ngrok dashboard to get the current URL, then use:
```
https://[YOUR_NGROK_URL]/api/whatsapp/webhook
```

Replace `[YOUR_NGROK_URL]` with the actual URL from ngrok dashboard.

