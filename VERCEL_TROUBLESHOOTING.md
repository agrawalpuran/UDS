# 🔍 Vercel Login Troubleshooting Guide

## If Login Still Doesn't Work After Deployment

### Step 1: Verify Vercel Deployment

1. **Check Latest Deployment:**
   - Go to https://vercel.com/dashboard
   - Select your project
   - Check "Deployments" tab
   - Verify latest deployment shows **"Ready"** status
   - Check commit hash includes: `a1a4795` (latest fix)

2. **Redeploy if Needed:**
   - If deployment is old, click "Redeploy"
   - Or push a new commit to trigger deployment

---

### Step 2: Verify Environment Variables

**Go to:** Vercel Dashboard → Your Project → Settings → Environment Variables

**Required Variables:**
```
MONGODB_URI=mongodb+srv://admin:Welcome%24123@cluster0.owr3ooi.mongodb.net/uniform-distribution?retryWrites=true&w=majority
ENCRYPTION_KEY=default-encryption-key-change-in-production-32-chars!!
NODE_ENV=production
```

**Important:**
- ✅ All variables must be set for **Production** environment
- ✅ `ENCRYPTION_KEY` must match exactly (32 characters)
- ✅ `MONGODB_URI` password must be URL-encoded (`$` → `%24`)

**After adding/updating variables:**
- Click "Redeploy" to apply changes

---

### Step 3: Check Vercel Function Logs

1. **Go to:** Vercel Dashboard → Your Project → Deployments
2. **Click:** Latest deployment
3. **Go to:** "Functions" tab
4. **Click:** `/api/employees` function
5. **Check logs** for:
   - `[getEmployeeByEmail]` messages
   - `[API /api/employees]` messages
   - Any error messages

**Look for:**
- ✅ `[getEmployeeByEmail] Raw employee found` - Good sign
- ✅ `[getEmployeeByEmail] Employee found` - Good sign
- ❌ `[getEmployeeByEmail] Employee not found` - Issue with lookup
- ❌ `Failed to decrypt` - Encryption key mismatch
- ❌ `Connection error` - MongoDB connection issue

---

### Step 4: Test API Endpoint Directly

**Test URL:**
```
https://your-project.vercel.app/api/employees?email=anjali.sharma@icicibank.com
```

**Expected Response:**
- **Status 200:** Employee found ✅
- **Status 404:** Employee not found ❌

**If 404:**
- Check Vercel function logs
- Verify employee exists in MongoDB Atlas
- Check encryption key matches

---

### Step 5: Verify MongoDB Atlas

1. **Check Network Access:**
   - Go to MongoDB Atlas → Network Access
   - Ensure `0.0.0.0/0` is allowed (for Vercel)

2. **Verify Employee Exists:**
   - Go to MongoDB Atlas → Collections
   - Check `employees` collection
   - Search for `id: 300041`
   - Verify email is encrypted (contains `:`)

3. **Test Connection:**
   - Use MongoDB Compass or Atlas UI
   - Try connecting with the connection string
   - Verify you can query the database

---

### Step 6: Clear Browser Cache

1. **Hard Refresh:**
   - Windows: `Ctrl + F5`
   - Mac: `Cmd + Shift + R`

2. **Clear Cache:**
   - Open DevTools (F12)
   - Right-click refresh button
   - Select "Empty Cache and Hard Reload"

3. **Try Incognito/Private Window:**
   - Open new incognito window
   - Try login again

---

## Common Issues & Solutions

### Issue 1: "Employee not found" (404)

**Possible Causes:**
1. Employee doesn't exist in Atlas
2. Email encryption format mismatch
3. Decryption failing

**Solutions:**
- ✅ Verify employee exists: Run `scripts/check-employee-atlas.js`
- ✅ Check email encryption: Should be base64 format
- ✅ Verify `ENCRYPTION_KEY` matches in Vercel

### Issue 2: "Failed to decrypt"

**Cause:** `ENCRYPTION_KEY` mismatch between local and Vercel

**Solution:**
- Ensure Vercel has exact same `ENCRYPTION_KEY`
- Redeploy after updating environment variable

### Issue 3: "Connection error"

**Cause:** MongoDB Atlas network access or connection string issue

**Solution:**
- Check MongoDB Atlas Network Access (allow `0.0.0.0/0`)
- Verify `MONGODB_URI` is correct in Vercel
- Check password is URL-encoded (`$` → `%24`)

### Issue 4: Code not deployed

**Cause:** Vercel hasn't deployed latest code

**Solution:**
- Check deployment status in Vercel
- Manually trigger redeploy
- Verify GitHub has latest commits

---

## Quick Verification Checklist

- [ ] Vercel deployment is "Ready" and recent
- [ ] Environment variables are set correctly
- [ ] `ENCRYPTION_KEY` matches exactly
- [ ] `MONGODB_URI` is correct and URL-encoded
- [ ] MongoDB Atlas allows `0.0.0.0/0` network access
- [ ] Employee exists in Atlas (ID: 300041)
- [ ] Browser cache cleared
- [ ] Vercel function logs checked

---

## Still Not Working?

### Get Detailed Logs:

1. **Check Vercel Function Logs:**
   - Look for `[getEmployeeByEmail]` messages
   - Check for decryption errors
   - Verify employee is being found

2. **Test Direct API Call:**
   ```
   curl https://your-project.vercel.app/api/employees?email=anjali.sharma@icicibank.com
   ```

3. **Check MongoDB Atlas:**
   - Verify employee 300041 exists
   - Check email field format
   - Verify companyId is set

4. **Contact Support:**
   - Share Vercel function logs
   - Share MongoDB Atlas connection status
   - Share environment variable names (not values)

---

**The fixes are complete. If it still doesn't work, it's likely a deployment or environment variable issue!** 🔧

