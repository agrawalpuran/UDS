# WhatsApp Integration - Testing Guide

This guide provides step-by-step instructions to test the WhatsApp ordering feature from your laptop or mobile phone.

## 🎯 Testing Options

### Option 1: Simulate WhatsApp Messages (No WhatsApp Provider Needed)
**Best for:** Initial testing, development, debugging
- Test the webhook endpoint directly
- Simulate WhatsApp messages using curl or Postman
- Works from laptop or mobile browser

### Option 2: Test with Actual WhatsApp (Requires Provider Setup)
**Best for:** End-to-end testing, user experience validation
- Requires WhatsApp Business API or Twilio setup
- Send real WhatsApp messages
- Test from actual WhatsApp app on mobile

---

## 📱 Option 1: Simulate WhatsApp Messages (Recommended for Initial Testing)

### Prerequisites
- UDS application running locally (`npm run dev`)
- Terminal/Command Prompt access
- curl installed (or use Postman/Thunder Client)

### Step 1: Start the Application

```bash
# Navigate to project directory
cd uniform-distribution-system

# Start the development server
npm run dev
```

The server should start on `http://localhost:3001`

### Step 2: Verify Webhook Endpoint is Accessible

Open your browser and visit:
```
http://localhost:3001/api/whatsapp/webhook
```

You should see a JSON response (verification endpoint).

### Step 3: Test Authentication Flow

#### Test 1: Send First Message (Should Authenticate)

**From Terminal (Windows PowerShell):**
```powershell
# Replace +919876543210 with an actual employee phone number from your database
$body = @{
    from = "+919876543210"
    message = "Hello"
    messageId = "test_001"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/api/whatsapp/webhook" -Method POST -Body $body -ContentType "application/json"
```

**From Terminal (Mac/Linux):**
```bash
curl -X POST http://localhost:3001/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+919876543210",
    "message": "Hello",
    "messageId": "test_001"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "messageId": "test_001",
  "to": "+919876543210",
  "message": "✅ Welcome, [Employee Name]!\n\n👕 *Uniform Distribution System*..."
}
```

**If authentication fails:**
- Check if the phone number exists in the `employees` collection
- Phone number must match exactly (including country code)
- Check server logs for errors

### Step 4: Test Main Menu

**Send:**
```json
{
  "from": "+919876543210",
  "message": "MENU",
  "messageId": "test_002"
}
```

**Expected Response:** Main menu with 4 options

### Step 5: Test Order Placement Flow

#### Step 5.1: Start Order (Option 1)
```json
{
  "from": "+919876543210",
  "message": "1",
  "messageId": "test_003"
}
```

**Expected:** List of eligible products

#### Step 5.2: Select a Product
```json
{
  "from": "+919876543210",
  "message": "1",
  "messageId": "test_004"
}
```

**Expected:** Product details with available sizes

#### Step 5.3: Select Size
```json
{
  "from": "+919876543210",
  "message": "M",
  "messageId": "test_005"
}
```

**Expected:** Prompt for quantity

#### Step 5.4: Enter Quantity
```json
{
  "from": "+919876543210",
  "message": "2",
  "messageId": "test_006"
}
```

**Expected:** Cart review with total

#### Step 5.5: Select Delivery Option
```json
{
  "from": "+919876543210",
  "message": "1",
  "messageId": "test_007"
}
```

**Expected:** Office pickup confirmation prompt

#### Step 5.6: Confirm Order
```json
{
  "from": "+919876543210",
  "message": "CONFIRM",
  "messageId": "test_008"
}
```

**Expected:** Order confirmation with order ID

### Step 6: Test Order History

```json
{
  "from": "+919876543210",
  "message": "2",
  "messageId": "test_009"
}
```

**Expected:** List of past orders

### Step 7: Test Order Status

```json
{
  "from": "+919876543210",
  "message": "3",
  "messageId": "test_010"
}
```

**Expected:** List of open orders

### Step 8: Test Global Commands

```json
{
  "from": "+919876543210",
  "message": "STATUS",
  "messageId": "test_011"
}
```

**Expected:** Open orders list

```json
{
  "from": "+919876543210",
  "message": "HELP",
  "messageId": "test_012"
}
```

**Expected:** Help information

---

## 🧪 Using Postman (Easier GUI Alternative)

### Step 1: Create a New Request

1. Open Postman
2. Create new POST request
3. URL: `http://localhost:3001/api/whatsapp/webhook`
4. Headers: `Content-Type: application/json`

### Step 2: Create Request Body

```json
{
  "from": "+919876543210",
  "message": "MENU",
  "messageId": "test_001"
}
```

### Step 3: Save as Collection

Create a collection with multiple requests:
- Authenticate
- Main Menu
- Start Order
- Select Product
- Select Size
- Enter Quantity
- Review Cart
- Confirm Order
- View Orders
- Check Status
- Help

### Step 4: Run Collection Sequentially

Use Postman's "Run Collection" feature to test the entire flow.

---

## 📱 Option 2: Test with Actual WhatsApp (Advanced)

### Prerequisites
- WhatsApp Business API account (Meta/Facebook)
- OR Twilio WhatsApp API account
- OR Custom WhatsApp gateway
- Public URL (ngrok, Vercel, or similar)

### Step 1: Set Up Public URL

#### Using ngrok (Recommended for Local Testing):

```bash
# Install ngrok (if not installed)
# Download from: https://ngrok.com/download

# Start your Next.js app
npm run dev

# In another terminal, start ngrok
ngrok http 3001
```

You'll get a public URL like: `https://abc123.ngrok.io`

#### Using Vercel (Production-like):

```bash
# Deploy to Vercel
vercel

# Or use existing deployment URL
```

### Step 2: Configure WhatsApp Provider

#### For Twilio:

1. Go to Twilio Console → WhatsApp Sandbox
2. Configure webhook URL: `https://your-ngrok-url.ngrok.io/api/whatsapp/webhook`
3. Join Twilio sandbox by sending code to Twilio number
4. Send messages to your Twilio WhatsApp number

#### For Meta WhatsApp Business API:

1. Go to Meta Business Manager
2. Configure webhook URL: `https://your-ngrok-url.ngrok.io/api/whatsapp/webhook`
3. Set verify token (must match `WHATSAPP_VERIFY_TOKEN` in `.env.local`)
4. Subscribe to message events
5. Send messages from approved WhatsApp Business number

### Step 3: Update Webhook Route (If Needed)

If your provider uses different field names, update `app/api/whatsapp/webhook/route.ts`:

**Example for Twilio:**
```typescript
const whatsappNumber = body.From || body.from
const messageText = body.Body || body.message
```

**Example for Meta:**
```typescript
// Meta sends nested structure
const entry = body.entry?.[0]
const change = entry?.changes?.[0]
const value = change?.value
const whatsappNumber = value?.messages?.[0]?.from
const messageText = value?.messages?.[0]?.text?.body
```

### Step 4: Test from WhatsApp App

1. Open WhatsApp on your phone
2. Send message to your WhatsApp Business number (or Twilio sandbox number)
3. Start with "MENU" or "Hello"
4. Follow the conversation flow

---

## 🔍 Debugging Tips

### 1. Check Server Logs

Watch your terminal where `npm run dev` is running. Look for:
- `[WhatsApp Webhook]` - Webhook received
- `[WhatsApp]` - State machine processing

### 2. Check Database

Query the `WhatsAppSession` collection:
```javascript
// In MongoDB shell or Compass
db.whatsappsessions.find({ whatsappNumber: "+919876543210" })
```

Check:
- `state` - Current conversation state
- `cart` - Items in cart
- `context` - Temporary context
- `employeeId` - Linked employee

### 3. Test Individual Functions

Create a test script `scripts/test-whatsapp.js`:

```javascript
const { processMessage } = require('../lib/whatsapp/state-handler')

async function test() {
  const response = await processMessage('+919876543210', 'MENU')
  console.log('Response:', response)
}

test()
```

Run: `node scripts/test-whatsapp.js`

### 4. Common Issues

**Issue: Authentication Fails**
- **Solution:** Check phone number format matches database
- Phone numbers are encrypted, so verify the format matches

**Issue: No Eligible Products**
- **Solution:** 
  - Check employee has remaining eligibility
  - Verify products are linked to employee's company
  - Check gender compatibility

**Issue: Order Creation Fails**
- **Solution:**
  - Check eligibility validation errors
  - Verify employee has valid companyId
  - Check order creation service logs

**Issue: State Not Persisting**
- **Solution:**
  - Check MongoDB connection
  - Verify WhatsAppSession model is working
  - Check session save operations

---

## 📋 Complete Test Checklist

### Authentication
- [ ] First message authenticates employee
- [ ] Invalid phone number shows error
- [ ] Authenticated user sees welcome message

### Main Menu
- [ ] Menu shows 4 options
- [ ] Option 1 starts order flow
- [ ] Option 2 shows past orders
- [ ] Option 3 shows open orders
- [ ] Option 4 shows help

### Order Flow
- [ ] Eligible products are listed
- [ ] Product selection works
- [ ] Size selection validates available sizes
- [ ] Quantity accepts 1-10
- [ ] Cart review shows correct items
- [ ] Delivery option selection works
- [ ] Order confirmation creates order in database
- [ ] Order ID is returned

### Order History
- [ ] Past orders are listed
- [ ] Order details show correctly
- [ ] Status information is accurate

### Global Commands
- [ ] MENU resets to main menu
- [ ] STATUS shows open orders
- [ ] HELP shows help information

### Error Handling
- [ ] Invalid input prompts retry
- [ ] Eligibility errors show specific messages
- [ ] All errors allow return to menu

---

## 🚀 Quick Test Script

Save this as `test-whatsapp-flow.sh` (or `.ps1` for Windows):

```bash
#!/bin/bash

PHONE="+919876543210"
BASE_URL="http://localhost:3001/api/whatsapp/webhook"

echo "Testing WhatsApp Flow..."

# 1. Authenticate
echo "1. Authenticating..."
curl -X POST $BASE_URL -H "Content-Type: application/json" -d "{\"from\":\"$PHONE\",\"message\":\"Hello\",\"messageId\":\"t1\"}"

# 2. Main Menu
echo "\n2. Getting menu..."
curl -X POST $BASE_URL -H "Content-Type: application/json" -d "{\"from\":\"$PHONE\",\"message\":\"MENU\",\"messageId\":\"t2\"}"

# 3. Start Order
echo "\n3. Starting order..."
curl -X POST $BASE_URL -H "Content-Type: application/json" -d "{\"from\":\"$PHONE\",\"message\":\"1\",\"messageId\":\"t3\"}"

echo "\n✅ Test complete! Check responses above."
```

**Windows PowerShell version** (`test-whatsapp-flow.ps1`):
```powershell
$phone = "+919876543210"
$baseUrl = "http://localhost:3001/api/whatsapp/webhook"

Write-Host "Testing WhatsApp Flow..." -ForegroundColor Green

# 1. Authenticate
Write-Host "1. Authenticating..." -ForegroundColor Yellow
$body1 = @{ from = $phone; message = "Hello"; messageId = "t1" } | ConvertTo-Json
Invoke-RestMethod -Uri $baseUrl -Method POST -Body $body1 -ContentType "application/json"

# 2. Main Menu
Write-Host "2. Getting menu..." -ForegroundColor Yellow
$body2 = @{ from = $phone; message = "MENU"; messageId = "t2" } | ConvertTo-Json
Invoke-RestMethod -Uri $baseUrl -Method POST -Body $body2 -ContentType "application/json"

# 3. Start Order
Write-Host "3. Starting order..." -ForegroundColor Yellow
$body3 = @{ from = $phone; message = "1"; messageId = "t3" } | ConvertTo-Json
Invoke-RestMethod -Uri $baseUrl -Method POST -Body $body3 -ContentType "application/json"

Write-Host "`n✅ Test complete!" -ForegroundColor Green
```

Run: `powershell -ExecutionPolicy Bypass -File test-whatsapp-flow.ps1`

---

## 📞 Need Help?

If you encounter issues:
1. Check server logs for error messages
2. Verify phone number exists in database
3. Check MongoDB connection
4. Verify employee has eligible products
5. Review the README.md for detailed troubleshooting

Happy Testing! 🎉

