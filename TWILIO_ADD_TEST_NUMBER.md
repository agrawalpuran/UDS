# How to Add Another Phone Number for WhatsApp Testing in Twilio

## Method 1: Add to WhatsApp Sandbox (Free - Recommended for Testing)

### Step 1: Access WhatsApp Sandbox Settings

1. **Go to Twilio Console:**
   - https://console.twilio.com
   - Log in to your account

2. **Navigate to WhatsApp Sandbox:**
   - Click **"Messaging"** in left sidebar
   - Click **"Try it out"** → **"Send a WhatsApp message"**
   - OR go directly to: https://console.twilio.com/us1/develop/sms/sandbox/whatsapp-sandbox

### Step 2: Add Your Phone Number

1. **Find "Join Code" section:**
   - You'll see a join code like: `join <code-word>`
   - Example: `join example-code`

2. **From your NEW phone:**
   - Open WhatsApp
   - Send the join code to the Twilio WhatsApp number
   - Example: Send `join example-code` to `+1 415 523 8886`

3. **Wait for confirmation:**
   - You'll receive a confirmation message
   - The number is now added to the sandbox

### Step 3: Test with New Number

- Send a message from your new phone number
- It will be received by the same webhook
- The webhook will process it the same way

---

## Method 2: Use Multiple Twilio Accounts (Advanced)

If you need completely separate testing environments:

1. **Create a new Twilio account:**
   - Go to: https://www.twilio.com/try-twilio
   - Sign up with a different email
   - Get new credentials

2. **Set up WhatsApp Sandbox:**
   - Follow the same setup process
   - Configure webhook URL
   - Add phone numbers

3. **Use different environment variables:**
   - Create `.env.local.test` for second account
   - Switch between accounts as needed

---

## Method 3: Upgrade to WhatsApp Business API (Production)

For production use with multiple numbers:

1. **Upgrade Twilio Account:**
   - Go to Twilio Console → Settings
   - Request WhatsApp Business API access
   - Complete business verification

2. **Purchase WhatsApp Numbers:**
   - Go to: Phone Numbers → Buy a Number
   - Select WhatsApp-enabled numbers
   - Assign to your application

3. **Configure Each Number:**
   - Set webhook URL for each number
   - Can use same webhook or different ones

---

## Quick Guide: Adding Second Test Number

### Current Setup:
- **Twilio WhatsApp Number:** `+1 415 523 8886` (example)
- **Join Code:** `join example-code`

### Steps:

1. **Get the join code:**
   - Go to: https://console.twilio.com/us1/develop/sms/sandbox/whatsapp-sandbox
   - Copy the join code

2. **From your second phone:**
   ```
   Open WhatsApp → Send "join example-code" to +1 415 523 8886
   ```

3. **Wait for confirmation:**
   - You'll receive: "You're all set! You can send and receive messages..."

4. **Test:**
   - Send a message from the second number
   - It will go to the same webhook
   - Your application will process it

---

## Testing with Multiple Numbers

### Test Scenario 1: Different Employees

1. **Add multiple phone numbers** (all use same join code)
2. **Each number represents a different employee**
3. **Test authentication:**
   - Each number should authenticate separately
   - Each gets their own session

### Test Scenario 2: Same Employee, Different Devices

1. **Add your phone numbers** to sandbox
2. **Test from different devices**
3. **Verify session persistence**

### Test Scenario 3: Multiple Companies

1. **Use different Twilio accounts** for different companies
2. **Each has separate webhook configuration**
3. **Test company-specific features**

---

## Important Notes

### WhatsApp Sandbox Limitations:

- **Free tier:** Up to 5 numbers can join the sandbox
- **Same join code:** All numbers use the same code
- **Same webhook:** All numbers send to the same webhook URL
- **24-hour window:** In sandbox, you can only message numbers that have messaged you first (within 24 hours)

### Best Practices:

1. **Use different phone numbers for different test scenarios:**
   - Employee 1: Your primary phone
   - Employee 2: Secondary phone or family member's phone
   - Employee 3: Work phone, etc.

2. **Test authentication:**
   - Each number should map to a different employee in your database
   - Verify phone numbers are correctly stored

3. **Test session isolation:**
   - Each number should have its own conversation state
   - Verify sessions don't interfere with each other

---

## Configuration Updates Needed

### If Using Different Webhooks:

If you want different numbers to use different webhooks:

1. **In Twilio Console:**
   - Go to WhatsApp Sandbox Settings
   - Configure webhook URL
   - All numbers in sandbox use the same webhook

2. **For Different Webhooks:**
   - You'll need WhatsApp Business API (paid)
   - Configure per-number webhooks

### Current Setup (Recommended):

- **Single webhook** handles all numbers
- **Your application** identifies the sender by phone number
- **No changes needed** - it works automatically

---

## Step-by-Step: Add Your Second Number

### 1. Get Join Code

1. Go to: https://console.twilio.com/us1/develop/sms/sandbox/whatsapp-sandbox
2. Look for: **"Join your sandbox"** section
3. Note the join code (e.g., `join example-code`)
4. Note the Twilio WhatsApp number (e.g., `+1 415 523 8886`)

### 2. Join from Second Phone

1. Open WhatsApp on your **second phone**
2. Start a new chat with the **Twilio WhatsApp number**
3. Send the **join code**
4. Wait for confirmation message

### 3. Verify

1. Send a test message from the second phone
2. Check your application logs
3. Verify it's being processed

### 4. Test Different Scenarios

- Test with different employee phone numbers
- Test authentication for each number
- Test order placement from different numbers
- Verify session isolation

---

## Troubleshooting

### Issue: Can't Join Sandbox

**Solution:**
- Make sure you're sending to the correct Twilio number
- Use the exact join code (case-sensitive)
- Wait a few seconds for confirmation

### Issue: Second Number Not Receiving Messages

**Solution:**
- Verify number joined successfully
- Check 24-hour window (must message first)
- Verify webhook is configured correctly

### Issue: Both Numbers Getting Same Response

**Solution:**
- This is expected if both numbers map to the same employee
- Each number should have its own employee record in database
- Verify phone numbers are different in employee records

---

## Quick Reference

**Twilio WhatsApp Sandbox:**
- URL: https://console.twilio.com/us1/develop/sms/sandbox/whatsapp-sandbox
- Join Code: Found in sandbox settings
- Twilio Number: Usually `+1 415 523 8886` (may vary)

**Webhook URL:**
- Your ngrok URL: `https://herpetological-aleida-unawarely.ngrok-free.dev/api/whatsapp/webhook`
- Same for all numbers in sandbox

**Testing:**
- All numbers use the same webhook
- Your app identifies sender by phone number
- Each number gets its own session

---

## Next Steps After Adding Number

1. ✅ Add phone number to sandbox
2. ✅ Test authentication (send "Hello" or "MENU")
3. ✅ Verify employee lookup works
4. ✅ Test order placement
5. ✅ Verify responses are sent correctly

---

**Ready to add your second number? Follow the steps above!**

