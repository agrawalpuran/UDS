# 🌐 Making UDS Available Over the Internet

## Quick Reference

**Current ngrok URL:** `https://herpetological-aleida-unawarely.ngrok-free.dev`

---

## Option 1: ngrok (Quick & Temporary) ⚡

### ✅ Already Running!

Your application is currently accessible at:
- **URL:** `https://herpetological-aleida-unawarely.ngrok-free.dev`
- **Status:** ✅ Active

### How to Share

1. **Share the URL directly:**
   ```
   https://herpetological-aleida-unawarely.ngrok-free.dev
   ```

2. **Keep ngrok running:**
   - Don't close the ngrok window
   - Keep your computer on
   - Keep the application running (`npm run dev`)

### Get Current URL Anytime

```powershell
# Method 1: Check ngrok web interface
# Open in browser: http://localhost:4040

# Method 2: Query API
$response = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels"
$response.tunnels[0].public_url
```

### Restart ngrok (if needed)

```powershell
# Stop ngrok
Get-Process ngrok | Stop-Process

# Start ngrok
Start-Process ngrok -ArgumentList "http", "3001" -WindowStyle Minimized

# Wait a few seconds, then get new URL
Start-Sleep -Seconds 5
$response = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels"
$response.tunnels[0].public_url
```

### ⚠️ Limitations

- URL changes every time you restart ngrok
- Free tier has connection limits
- Requires your computer to be on
- May show warning page on first visit

---

## Option 2: Deploy to Vercel (Permanent & Production) 🚀

### Why Vercel?

- ✅ **Permanent URL** (doesn't change)
- ✅ **Always online** (no need to keep computer running)
- ✅ **Free tier** with generous limits
- ✅ **Automatic deployments** from GitHub
- ✅ **HTTPS included**
- ✅ **Fast global CDN**

### Prerequisites

1. ✅ Code on GitHub (already done: `agrawalpuran/UDS`)
2. ✅ MongoDB Atlas connection string
3. ⏳ Vercel account (free)

### Step-by-Step Deployment

#### Step 1: Create Vercel Account (2 minutes)

1. Go to: https://vercel.com
2. Click **"Sign Up"**
3. Choose **"Continue with GitHub"**
4. Authorize Vercel to access your GitHub

#### Step 2: Import Project (3 minutes)

1. In Vercel dashboard, click **"Add New..."** → **"Project"**
2. Find your repository: `agrawalpuran/UDS`
3. Click **"Import"**

#### Step 3: Configure Project (2 minutes)

1. **Framework Preset:** Next.js (auto-detected) ✅
2. **Root Directory:** `./` (default) ✅
3. **Build Command:** `npm run build` (default) ✅
4. **Output Directory:** `.next` (default) ✅

#### Step 4: Add Environment Variables (2 minutes)

**Critical:** Add your MongoDB connection string!

1. Scroll down to **"Environment Variables"**
2. Click **"Add"**
3. Add these variables:

   | Name | Value | Environments |
   |------|-------|--------------|
   | `MONGODB_URI` | Your MongoDB Atlas connection string | ☑ Production ☑ Preview ☑ Development |
   | `NEXTAUTH_SECRET` | (if using NextAuth) | ☑ Production ☑ Preview ☑ Development |
   | `NEXTAUTH_URL` | `https://your-project-name.vercel.app` | ☑ Production |

   **Example MongoDB URI:**
   ```
   mongodb+srv://admin:Welcome$123@cluster0.owr3ooi.mongodb.net/uniform-distribution?retryWrites=true&w=majority
   ```

4. Click **"Save"** for each variable

#### Step 5: Deploy (3-5 minutes)

1. Click **"Deploy"**
2. Wait for build to complete (2-3 minutes)
3. ✅ **Your app is live!**

You'll get a URL like: `https://uds.vercel.app` or `https://uniform-distribution-system.vercel.app`

#### Step 6: Verify Deployment

1. Visit your live URL
2. Test login functionality
3. Check if data loads correctly
4. Test API endpoints

---

## Comparison: ngrok vs Vercel

| Feature | ngrok (Current) | Vercel (Recommended) |
|---------|----------------|----------------------|
| **URL Stability** | Changes on restart | Permanent |
| **Uptime** | Requires your PC on | Always online |
| **Setup Time** | ✅ Already done | 10-15 minutes |
| **Cost** | Free (limited) | Free tier available |
| **Performance** | Depends on your internet | Global CDN |
| **Best For** | Testing, demos | Production, sharing |

---

## Quick Commands Reference

### ngrok Commands

```powershell
# Start ngrok
Start-Process ngrok -ArgumentList "http", "3001" -WindowStyle Minimized

# Get current URL
$response = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels"
$response.tunnels[0].public_url

# Stop ngrok
Get-Process ngrok | Stop-Process

# Check if ngrok is running
Get-Process ngrok -ErrorAction SilentlyContinue
```

### Vercel Commands (Optional - CLI)

```powershell
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel

# Deploy to production
vercel --prod
```

---

## Recommended Approach

**For immediate sharing:** Use ngrok (already running)
- Share: `https://herpetological-aleida-unawarely.ngrok-free.dev`

**For permanent access:** Deploy to Vercel
- Takes 10-15 minutes
- Provides permanent URL
- Always available

---

## Troubleshooting

### ngrok Issues

**Problem:** URL not working
- **Solution:** Check if ngrok is running: `Get-Process ngrok`
- **Solution:** Check if app is running: `Get-NetTCPConnection -LocalPort 3001`

**Problem:** URL changed
- **Solution:** This is normal - ngrok free tier generates new URLs
- **Solution:** Get new URL from `http://localhost:4040`

### Vercel Issues

**Problem:** Build fails
- **Solution:** Check build logs in Vercel dashboard
- **Solution:** Test build locally: `npm run build`

**Problem:** Database connection fails
- **Solution:** Verify `MONGODB_URI` environment variable in Vercel
- **Solution:** Check MongoDB Atlas network access (must allow `0.0.0.0/0`)

---

## Next Steps

1. **Immediate:** Share ngrok URL with others
2. **Short-term:** Deploy to Vercel for permanent access
3. **Long-term:** Consider custom domain (optional)

---

## Support

- **ngrok Dashboard:** http://localhost:4040
- **Vercel Dashboard:** https://vercel.com/dashboard
- **MongoDB Atlas:** https://cloud.mongodb.com

