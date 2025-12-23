# How to Start the Application

## Quick Start

1. **Open a PowerShell or Terminal window**

2. **Navigate to project directory:**
   ```powershell
   cd "C:\Users\pagrawal\OneDrive - CSG Systems Inc\Personal\Cursor AI\uniform-distribution-system"
   ```

3. **Start the application:**
   ```powershell
   npm run dev
   ```

4. **Wait for this message:**
   ```
   ✓ Ready on http://localhost:3001
   ```

5. **Open in browser:**
   ```
   http://localhost:3001
   ```

## Verify It's Running

### Check Port
```powershell
Get-NetTCPConnection -LocalPort 3001
```

Should show port 3001 in LISTEN state.

### Test in Browser
Open: http://localhost:3001

Should show the UDS login page or application.

### Test Webhook
```powershell
Invoke-WebRequest -Uri "http://localhost:3001/api/whatsapp/webhook" -Method GET
```

Should return status 200.

## Common Issues

### Issue: Port Already in Use

**Fix:**
```powershell
# Find and stop process using port 3001
Get-Process -Name node | Stop-Process -Force
```

### Issue: Application Won't Start

**Check:**
1. Node.js is installed: `node --version`
2. Dependencies installed: `npm install`
3. Environment variables set in `.env.local`
4. MongoDB connection is working

### Issue: Compilation Errors

**Check terminal for:**
- TypeScript errors
- Missing imports
- Syntax errors

## Keep Application Running

- **Don't close the terminal** where `npm run dev` is running
- **Keep it running** while testing WhatsApp integration
- **Use Ctrl+C** to stop when done

## Next Steps After Starting

1. ✅ Application running on http://localhost:3001
2. ✅ Start ngrok: `npm run ngrok`
3. ✅ Configure Twilio webhook with ngrok URL
4. ✅ Test from WhatsApp

