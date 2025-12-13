# ⚡ Quick Guide: Update MONGODB_URI in Vercel

## 🎯 What You Need

**Variable Name:** `MONGODB_URI`

**Variable Value (Copy This):**
```
mongodb+srv://admin:Welcome%24123@cluster0.owr3ooi.mongodb.net/uniform-distribution?retryWrites=true&w=majority
```

---

## 📝 5-Minute Steps

### 1. Go to Vercel
👉 https://vercel.com/dashboard

### 2. Open Your Project
👉 Click on your project name

### 3. Go to Settings
👉 Click **"Settings"** tab → **"Environment Variables"**

### 4. Add/Edit Variable
👉 Click **"Add New"** (or edit existing `MONGODB_URI`)
- **Key:** `MONGODB_URI`
- **Value:** Paste the connection string above
- **Environments:** ✅ Check all (Production, Preview, Development)
- **Save**

### 5. Redeploy
👉 Go to **"Deployments"** → Click **"..."** on latest → **"Redeploy"**

### 6. Verify
👉 Check logs for: `✅ MongoDB Connected Successfully`

---

## ✅ Done!

Your data should now display correctly.

---

**Full detailed guide:** See `HOW_TO_UPDATE_MONGODB_URI.md`



