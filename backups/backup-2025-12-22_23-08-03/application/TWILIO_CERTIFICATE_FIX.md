# Fix: Twilio "Certificate Invalid - Domain Mismatch" Error

## Problem
Twilio is rejecting webhook requests because ngrok free domains have SSL certificate issues that Twilio's security validation doesn't trust.

## Solutions

### Solution 1: Use ngrok with Static Domain (Recommended for Production)

**For Testing (Free ngrok):**
- The free ngrok domains have certificate issues
- Twilio validates SSL certificates strictly
- This causes "Certificate Invalid" errors

**Option A: Upgrade ngrok (Paid Plan)**
1. Sign up for ngrok paid plan
2. Get a static domain with proper SSL
3. Use that domain for webhook

**Option B: Use ngrok with Custom Domain (Free with limitations)**
- Configure a custom domain in ngrok
- Requires domain ownership

### Solution 2: Configure Twilio to Accept Webhook (Temporary Fix)

**Important:** This is for testing only, not recommended for production.

1. **In Twilio Console:**
   - Go to: https://console.twilio.com/us1/develop/sms/sandbox/whatsapp-sandbox
   - Find "When a message comes in" webhook URL
   - Look for **"Validate webhook signature"** or **"SSL validation"** option
   - **Disable SSL validation** (if available)
   - Save

2. **Note:** This option may not be available in all Twilio accounts

### Solution 3: Use Different Tunneling Service

**Alternatives to ngrok:**
- **Cloudflare Tunnel** (free, better SSL)
- **localtunnel** (free, but similar issues)
- **serveo.net** (free SSH tunnel)
- **PageKite** (free tier available)

### Solution 4: Deploy to Production URL

**Best Solution:**
- Deploy your application to a production URL (Vercel, Heroku, etc.)
- Use that URL for webhook (has proper SSL)
- No certificate issues

---

## Quick Fix for Testing

### Step 1: Verify ngrok is using HTTPS

Make sure your webhook URL uses `https://` not `http://`:
```
✅ https://herpetological-aleida-unawarely.ngrok-free.dev/api/whatsapp/webhook
❌ http://herpetological-aleida-unawarely.ngrok-free.dev/api/whatsapp/webhook
```

### Step 2: Check Twilio Webhook Configuration

1. Go to: https://console.twilio.com/us1/develop/sms/sandbox/whatsapp-sandbox
2. Verify webhook URL is correct
3. Make sure it's using HTTPS

### Step 3: Try ngrok with --host-header option

Restart ngrok with:
```bash
ngrok http 3001 --host-header=localhost:3001
```

### Step 4: Test Webhook Manually

Test if webhook is accessible:
```powershell
Invoke-WebRequest -Uri "https://herpetological-aleida-unawarely.ngrok-free.dev/api/whatsapp/webhook" -Method GET
```

---

## Recommended: Deploy to Vercel (Free)

**Best long-term solution:**

1. **Deploy to Vercel:**
   ```bash
   npm install -g vercel
   vercel
   ```

2. **Get Production URL:**
   - Vercel provides: `https://your-app.vercel.app`
   - This has proper SSL certificate

3. **Update Twilio Webhook:**
   - Use: `https://your-app.vercel.app/api/whatsapp/webhook`
   - No certificate issues

---

## Alternative: Use Cloudflare Tunnel (Free, Better SSL)

1. **Install Cloudflare Tunnel:**
   ```bash
   # Download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/
   ```

2. **Create Tunnel:**
   ```bash
   cloudflared tunnel --url http://localhost:3001
   ```

3. **Use the provided URL** (has proper SSL)

---

## Immediate Workaround

For testing purposes, you can:

1. **Ignore the certificate error in Twilio** (if option available)
2. **Use a different ngrok region:**
   ```bash
   ngrok http 3001 --region us
   ```

3. **Check if webhook is actually working:**
   - Even with certificate warnings, webhooks might still work
   - Check your application logs
   - Check ngrok web interface: http://localhost:4040

---

## Check Current Status

1. **Verify webhook is accessible:**
   - Open: https://herpetological-aleida-unawarely.ngrok-free.dev/api/whatsapp/webhook
   - Should see response (not certificate error)

2. **Check ngrok logs:**
   - Open: http://localhost:4040
   - See if requests are coming through

3. **Check application logs:**
   - Watch terminal where `npm run dev` is running
   - Look for `[WhatsApp Webhook]` messages

---

## Next Steps

1. **For immediate testing:** Try restarting ngrok with different options
2. **For production:** Deploy to Vercel or use paid ngrok
3. **For free long-term:** Use Cloudflare Tunnel

Let me know which approach you'd like to try!

