# WhatsApp Integration - Troubleshooting Guide

## Current Status Check

### 1. Verify Application is Running

```powershell
Get-NetTCPConnection -LocalPort 3001
```

Should show port 3001 in LISTEN state.

### 2. Test Webhook Endpoint

```powershell
# Test GET
Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/webhook" -Method GET

# Test POST (Twilio format)
$body = "From=whatsapp%3A%2B919876543210&Body=TEST&MessageSid=test123"
Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/webhook" -Method POST -Body $body -ContentType "application/x-www-form-urlencoded"
```

### 3. Check Application Logs

Watch the terminal where `npm run dev` is running. Look for:
- Compilation errors
- Runtime errors
- `[WhatsApp Webhook]` log messages

### 4. Check ngrok Status

Open: http://localhost:4040
- Should show active tunnel
- Should show incoming requests

## Common Issues and Fixes

### Issue: Error 500 on Webhook

**Possible Causes:**
1. Import errors (missing modules)
2. Database connection issues
3. Environment variables missing
4. Code compilation errors

**Fix:**
1. Check application logs for specific errors
2. Verify all environment variables in `.env.local`
3. Check MongoDB connection
4. Restart application

### Issue: Error 11200 (Twilio Timeout)

**Fix Applied:**
- Webhook now returns 200 immediately
- Message processing is asynchronous
- Should be resolved

**If still occurring:**
1. Check application response time
2. Verify webhook returns 200 status
3. Check ngrok latency

### Issue: Certificate Invalid

**Fix:**
- Use correct ngrok URL (no double domain)
- For production: Deploy to Vercel

### Issue: Webhook Not Receiving Messages

**Check:**
1. ngrok is running
2. Twilio webhook URL is correct
3. Application is running
4. Check ngrok dashboard for incoming requests

## Manual Testing Steps

### Step 1: Test Locally

```powershell
# Test webhook directly
$body = @{
    From = "whatsapp:+919876543210"
    Body = "MENU"
    MessageSid = "test_$(Get-Date -Format 'yyyyMMddHHmmss')"
}
Invoke-RestMethod -Uri "http://localhost:3001/api/whatsapp/webhook" -Method POST -Body $body -ContentType "application/x-www-form-urlencoded"
```

### Step 2: Test via ngrok

```powershell
# Get ngrok URL
$tunnels = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels"
$url = $tunnels.tunnels[0].public_url

# Test
$body = "From=whatsapp%3A%2B919876543210&Body=TEST&MessageSid=test123"
Invoke-WebRequest -Uri "$url/api/whatsapp/webhook" -Method POST -Body $body -ContentType "application/x-www-form-urlencoded"
```

### Step 3: Check Database

Verify employee phone numbers exist:
```javascript
// In MongoDB
db.employees.find({}, { mobile: 1, firstName: 1, lastName: 1 }).limit(5)
```

## Environment Variables Checklist

Verify these are set in `.env.local`:

```env
MONGODB_URI=...
ENCRYPTION_KEY=...
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
WHATSAPP_VERIFY_TOKEN=...
```

## Next Steps

1. **Check application logs** for specific error messages
2. **Test webhook manually** using commands above
3. **Verify all components** are running:
   - Application (port 3001)
   - Ngrok (port 4040)
   - MongoDB (connection)
4. **Test from WhatsApp** after verifying everything

## Getting Help

If issues persist:
1. Share application log errors
2. Share Twilio error details
3. Share ngrok dashboard screenshot
4. Share webhook test results

