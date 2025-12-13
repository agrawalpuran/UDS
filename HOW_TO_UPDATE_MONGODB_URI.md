# 📝 How to Update MONGODB_URI in Vercel

## 🎯 Quick Summary

You need to update the `MONGODB_URI` environment variable in Vercel with the URL-encoded password.

**Corrected Connection String:**
```
mongodb+srv://admin:Welcome%24123@cluster0.owr3ooi.mongodb.net/uniform-distribution?retryWrites=true&w=majority
```

**Note:** The password `Welcome$123` is encoded as `Welcome%24123` (the `$` becomes `%24`)

---

## 📋 Step-by-Step Instructions

### Step 1: Go to Vercel Dashboard

1. Open your browser
2. Go to: **https://vercel.com/dashboard**
3. Log in if needed

### Step 2: Select Your Project

1. Find your project in the dashboard
2. Click on the project name to open it

### Step 3: Navigate to Settings

1. Click on the **"Settings"** tab at the top
2. In the left sidebar, click **"Environment Variables"**

### Step 4: Add or Edit MONGODB_URI

**Option A: If MONGODB_URI doesn't exist yet**

1. Click the **"Add New"** button
2. Fill in:
   - **Key:** `MONGODB_URI`
   - **Value:** `mongodb+srv://admin:Welcome%24123@cluster0.owr3ooi.mongodb.net/uniform-distribution?retryWrites=true&w=majority`
   - **Environments:** Check all three:
     - ✅ Production
     - ✅ Preview
     - ✅ Development
3. Click **"Save"**

**Option B: If MONGODB_URI already exists**

1. Find `MONGODB_URI` in the list
2. Click the **"Edit"** button (pencil icon) or click on the row
3. Update the **Value** field with:
   ```
   mongodb+srv://admin:Welcome%24123@cluster0.owr3ooi.mongodb.net/uniform-distribution?retryWrites=true&w=majority
   ```
4. Ensure all environments are selected:
   - ✅ Production
   - ✅ Preview
   - ✅ Development
5. Click **"Save"**

### Step 5: Redeploy Your Application

After saving the environment variable, you need to redeploy:

**Method 1: Redeploy from Deployments Page**

1. Go to **"Deployments"** tab
2. Find the latest deployment
3. Click the **"..."** (three dots) menu
4. Click **"Redeploy"**
5. Confirm the redeploy

**Method 2: Trigger New Deployment**

1. Make a small change to your code (or just push to GitHub)
2. Vercel will automatically deploy with the new environment variable

---

## 🔍 Verify the Update

### Check 1: Verify Environment Variable

1. Go back to **Settings → Environment Variables**
2. Verify `MONGODB_URI` shows the corrected value
3. Check that all environments are selected

### Check 2: Check Deployment Logs

1. Go to **Deployments → Latest Deployment**
2. Click **"Logs"** tab
3. Look for: `✅ MongoDB Connected Successfully`
4. If you see errors, check the error message

### Check 3: Test API Endpoints

Visit these URLs (replace `your-app` with your actual Vercel URL):

```
https://your-app.vercel.app/api/employees
https://your-app.vercel.app/api/products?companyId=COMP-INDIGO
```

**Expected:** JSON response with data  
**If Error:** Check the error message in the response

---

## ⚠️ Important Notes

### Password Encoding

Your password `Welcome$123` contains special characters that must be URL-encoded:

- `$` → `%24`
- `@` → `%40`
- `#` → `%23`
- `%` → `%25`
- `&` → `%26`
- `+` → `%2B`
- `=` → `%3D`
- `?` → `%3F`
- Space → `%20`

**Your password:** `Welcome$123`  
**Encoded:** `Welcome%24123`

### Connection String Format

The full connection string must include:

✅ Protocol: `mongodb+srv://`  
✅ Username: `admin`  
✅ Password: `Welcome%24123` (URL-encoded)  
✅ Cluster: `cluster0.owr3ooi.mongodb.net`  
✅ Database: `/uniform-distribution`  
✅ Options: `?retryWrites=true&w=majority`

---

## 🚨 Troubleshooting

### Issue: "Environment variable not found"

**Solution:**
- Make sure you're in the correct project
- Check that the variable name is exactly `MONGODB_URI` (case-sensitive)
- Ensure you saved the variable

### Issue: "Connection still failing after update"

**Check:**
1. ✅ Password is URL-encoded correctly
2. ✅ All environments are selected (Production, Preview, Development)
3. ✅ Redeployed after updating
4. ✅ MongoDB Atlas Network Access allows `0.0.0.0/0`

### Issue: "How do I know if it's working?"

**Signs it's working:**
- ✅ Vercel logs show: `✅ MongoDB Connected Successfully`
- ✅ API endpoints return data (not errors)
- ✅ Application pages display data correctly
- ✅ No connection errors in browser console

---

## 📋 Quick Checklist

- [ ] Logged into Vercel dashboard
- [ ] Selected correct project
- [ ] Went to Settings → Environment Variables
- [ ] Added/Updated `MONGODB_URI` with corrected value
- [ ] Selected all environments (Production, Preview, Development)
- [ ] Saved the environment variable
- [ ] Redeployed the application
- [ ] Checked deployment logs for "✅ MongoDB Connected"
- [ ] Tested API endpoints
- [ ] Verified data displays on pages

---

## 🎯 Copy-Paste Ready Value

Here's the exact value to paste into Vercel:

```
mongodb+srv://admin:Welcome%24123@cluster0.owr3ooi.mongodb.net/uniform-distribution?retryWrites=true&w=majority
```

**Steps:**
1. Copy the entire line above
2. In Vercel: Settings → Environment Variables
3. Add/Edit `MONGODB_URI`
4. Paste the value
5. Select all environments
6. Save
7. Redeploy

---

## ✅ After Updating

Once you've updated and redeployed:

1. **Wait 2-3 minutes** for deployment to complete
2. **Check logs** for connection success message
3. **Test your application** - data should now display
4. **Verify** by logging in and checking if data loads

---

**Need help?** Run the automated fix script:
```powershell
npm run auto-fix-deployment
```

This will show you the exact connection string to use.



